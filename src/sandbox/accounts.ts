import { assemble, conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import type { Db } from "mongodb";
import authenticatingSpec from "@design/concepts/Authenticating.md" with { type: "text" };
import sessioningSpec from "@design/concepts/Sessioning.md" with { type: "text" };
import { AuthenticatingConcept, InvalidCredentials, UsernameTaken } from "../concepts/Authenticating.ts";
import { SessioningConcept } from "../concepts/Sessioning.ts";

const authConcepts = conceptSet({
  Authenticating: registerConcept({
    class: AuthenticatingConcept,
    spec: authenticatingSpec,
    refusals: { INVALID_CREDENTIALS: InvalidCredentials, USERNAME_TAKEN: UsernameTaken },
  }),
  Sessioning: registerConcept({ class: SessioningConcept, spec: sessioningSpec }),
});
const { Authenticating, Sessioning } = authConcepts.concepts;

const Register = endpoint("/auth/register", ({ username, password, account, session }) =>
  receive({ username, password })
    .then(Authenticating.register({ username, password }).responds({ account }))
    .then(Sessioning.start({ subject: account }).responds({ session }))
    .then(respond({ account, session })),
);

const SignIn = endpoint("/auth/sign-in", ({ username, password, account, session }) =>
  receive({ username, password })
    .then(Authenticating.authenticate({ username, password }).responds({ account }))
    .then(Sessioning.start({ subject: account }).responds({ session }))
    .then(respond({ account, session })),
);

// Account flows run outside the sandbox activity log, which records action inputs.
export function buildAccounts(db: Db) {
  return assemble({
    conceptSet: authConcepts,
    instances: { Authenticating: new AuthenticatingConcept(db), Sessioning: new SessioningConcept() },
    composition: { Accounts: { Register, SignIn } },
    logSink: { append() {} },
  });
}
