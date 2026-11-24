import { buildApplication } from "./src/build.ts";

export default {
  assemble: buildApplication,
  title: "Transpose",
  wireName: "TransposeWire",
  design: { version: 1, documents: [
    new URL("./design/types.md", import.meta.url),
    new URL("./design/compositions/Transposing.md", import.meta.url),
  ] },
};
