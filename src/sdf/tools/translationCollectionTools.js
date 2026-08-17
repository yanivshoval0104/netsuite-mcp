import { z } from "zod";
import { buildTranslationCollectionXml } from "../translationCollection.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const stringSchema = z.object({
  scriptId: z.string(),
  defaultTranslation: z.string(),
  description: z.string().optional(),
});

export function registerTranslationCollectionTools(server) {
  server.tool(
    "netsuite_create_translation_collection",
    "Creates a Translation Collection via SDF (writes XML, then project:validate/deploy). Uses " +
      "inline <strings> (scriptid + defaulttranslation per term), not external XLIFF files.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'mystrings' -> custcollection_mystrings"),
      name: z.string(),
      defaultLanguage: z.string().describe("e.g. 'en'"),
      description: z.string().optional(),
      strings: z.array(stringSchema).describe("At least one required"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildTranslationCollectionXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
