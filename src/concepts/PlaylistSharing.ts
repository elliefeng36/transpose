import { MongoServerError, type Collection, type Db } from "mongodb";

export class SharingDenied extends Error {}

interface Membership {
  member: string;
  canAdd: boolean;
  canRemove: boolean;
}

interface Invite {
  invite: string;
  inviter: string;
  invitee: string;
}

interface Share {
  _id: string;
  owner: string;
  revision: string;
  memberships: Membership[];
  invites: Invite[];
}

export class PlaylistSharingConcept {
  private readonly shares: Collection<Share>;

  constructor(db: Db) {
    this.shares = db.collection<Share>("playlistSharing.shares");
  }

  async startSharing({ playlist, owner }: { playlist: string; owner: string }) {
    try {
      await this.shares.insertOne({
        _id: playlist, owner, revision: crypto.randomUUID(), memberships: [], invites: [],
      });
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      const existing = await this.shares.findOne({ _id: playlist, owner });
      if (!existing) throw new SharingDenied("This playlist already has an owner.");
    }
    return { playlist };
  }

  // Read and update a single share atomically, retrying if another instance changed it.
  async #change(filter: { _id: string } | { "invites.invite": string }, edit: (share: Share) => void) {
    for (;;) {
      const share = await this.shares.findOne(filter);
      if (!share) throw new SharingDenied("Playlist or invitation unavailable.");
      edit(share);
      const result = await this.shares.updateOne(
        { _id: share._id, revision: share.revision },
        { $set: { memberships: share.memberships, invites: share.invites, revision: crypto.randomUUID() } },
      );
      if (result.matchedCount) return;
    }
  }

  async invite({ playlist, inviter, invitee }: { playlist: string; inviter: string; invitee: string }) {
    const invite = crypto.randomUUID();
    await this.#change({ _id: playlist }, (share) => {
      if (share.owner !== inviter || invitee === inviter ||
          share.memberships.some((entry) => entry.member === invitee) ||
          share.invites.some((entry) => entry.invitee === invitee)) {
        throw new SharingDenied("Only the owner can invite someone who is not already a member or invitee.");
      }
      share.invites.push({ invite, inviter, invitee });
    });
    return { invite };
  }

  async #resolveInvite(invite: string, user: string, accept: boolean) {
    await this.#change({ "invites.invite": invite }, (share) => {
      const pending = share.invites.find((entry) => entry.invite === invite);
      if (pending?.invitee !== user) throw new SharingDenied("Only the invitee can respond.");
      if (accept) share.memberships.push({ member: user, canAdd: true, canRemove: false });
      share.invites = share.invites.filter((entry) => entry.invite !== invite);
    });
    return { invite };
  }

  async accept({ invite, user }: { invite: string; user: string }) {
    return this.#resolveInvite(invite, user, true);
  }

  async decline({ invite, user }: { invite: string; user: string }) {
    return this.#resolveInvite(invite, user, false);
  }

  async setPermissions({ playlist, owner, member, canAdd, canRemove }: {
    playlist: string; owner: string; member: string; canAdd: boolean; canRemove: boolean;
  }) {
    await this.#change({ _id: playlist }, (share) => {
      const membership = share.memberships.find((entry) => entry.member === member);
      if (share.owner !== owner || !membership) throw new SharingDenied("Only the owner can change a member's permissions.");
      membership.canAdd = canAdd;
      membership.canRemove = canRemove;
    });
    return { playlist };
  }

  async removeMember({ playlist, owner, member }: { playlist: string; owner: string; member: string }) {
    await this.#change({ _id: playlist }, (share) => {
      if (share.owner !== owner || !share.memberships.some((entry) => entry.member === member)) {
        throw new SharingDenied("Only the owner can remove a member.");
      }
      share.memberships = share.memberships.filter((entry) => entry.member !== member);
    });
    return { playlist };
  }

  async leave({ playlist, member }: { playlist: string; member: string }) {
    await this.#change({ _id: playlist }, (share) => {
      if (!share.memberships.some((entry) => entry.member === member)) throw new SharingDenied("You are not a member.");
      share.memberships = share.memberships.filter((entry) => entry.member !== member);
    });
    return { playlist };
  }

  async stopSharing({ playlist, owner }: { playlist: string; owner: string }) {
    const result = await this.shares.deleteOne({ _id: playlist, owner });
    if (!result.deletedCount) throw new SharingDenied("Only the owner can stop sharing.");
    return { playlist };
  }

  async #permission(playlist: string, user: string, edit?: "canAdd" | "canRemove") {
    const share = await this.shares.findOne({ _id: playlist });
    const membership = share?.memberships.find((entry) => entry.member === user);
    const allowed = share?.owner === user || (membership !== undefined && (edit === undefined || membership[edit]));
    return { allowed };
  }

  async _canView({ playlist, user }: { playlist: string; user: string }) {
    return this.#permission(playlist, user);
  }

  async _canAdd({ playlist, user }: { playlist: string; user: string }) {
    return this.#permission(playlist, user, "canAdd");
  }

  async _canRemove({ playlist, user }: { playlist: string; user: string }) {
    return this.#permission(playlist, user, "canRemove");
  }

  async _getMembers({ playlist }: { playlist: string }) {
    const share = await this.shares.findOne({ _id: playlist });
    return share?.memberships.map((entry) => ({ owner: share.owner, ...entry })) ?? [];
  }

  async _getInvites({ invitee }: { invitee: string }) {
    const shares = await this.shares.find({ "invites.invitee": invitee }).toArray();
    return shares.flatMap((share) => share.invites.filter((entry) => entry.invitee === invitee)
      .map((entry) => ({ ...entry, playlist: share._id })));
  }

  async _getSharedPlaylists({ user }: { user: string }) {
    const shares = await this.shares.find({ $or: [{ owner: user }, { "memberships.member": user }] }).toArray();
    return shares.map((share) => ({ playlist: share._id }));
  }
}
