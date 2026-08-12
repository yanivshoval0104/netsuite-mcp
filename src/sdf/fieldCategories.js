// SDF custom-field object categories this tool supports, and the "appliesto*"
// flags each one accepts. Source: NetSuite SDF XML reference for
// entitycustomfield / transactionbodycustomfield / itemcustomfield.
// Not exhaustive (customfieldfilters/roleaccesses nested elements are not
// supported here) — covers the common case of adding a field visible on a
// standard record with a label, type, and optional target subtypes.

export const FIELD_CATEGORIES = {
  entity: {
    tag: "entitycustomfield",
    scriptidPrefix: "custentity_",
    description: "Custom field on entity records (Customer, Vendor, Employee, Contact, Partner, Project, etc.)",
    appliesTo: [
      "appliestocontact",
      "appliestocustomer",
      "appliestoemployee",
      "appliestogenericrsrc",
      "appliestogroup",
      "appliestoothername",
      "appliestopartner",
      "appliestopricelist",
      "appliestoproject",
      "appliestoprojecttemplate",
      "appliestostatement",
      "appliestovendor",
      "appliestowebsite",
    ],
  },
  transactionBody: {
    tag: "transactionbodycustomfield",
    scriptidPrefix: "custbody_",
    description: "Custom field on the body (header) of transactions (Sales Order, Invoice, Purchase Order, etc.)",
    appliesTo: [
      "appliestoestimate",
      "appliestocreditmemo",
      "appliestoinvoice",
      "appliestoitemshipment",
      "appliestoitemreceipt",
      "appliestoopportunity",
      "appliestopurchaseorder",
      "appliestosalesorder",
      "appliestovendorbill",
      "appliestovendorcredit",
      "appliestojournalentry",
      "appliestostatement",
    ],
  },
  item: {
    tag: "itemcustomfield",
    scriptidPrefix: "custitem_",
    description: "Custom field on item records (Inventory Item, Service Item, etc.)",
    appliesTo: [
      "appliestoinventory",
      "appliestononinventory",
      "appliestoservice",
      "appliestootherpurchases",
      "appliestogroup",
      "appliestokit",
      "appliestoassembly",
    ],
  },
};

export const VALID_FIELD_TYPES = [
  "CURRENCY",
  "FLOAT",
  "EMAIL",
  "TEXT",
  "HELP",
  "URL",
  "INLINEHTML",
  "INTEGER",
  "PERCENT",
  "PHONE",
  "TEXTAREA",
  "CHECKBOX",
  "DATE",
  "DATETIME",
  "SELECT",
  "MULTISELECT",
];

export function resolveCategory(category) {
  const def = FIELD_CATEGORIES[category];
  if (!def) {
    const valid = Object.keys(FIELD_CATEGORIES).join(", ");
    throw new Error(`Unknown field category '${category}'. Valid categories: ${valid}`);
  }
  return def;
}
