// SDF custom-field object categories this tool supports. Source: NetSuite SDF XML reference for
// entitycustomfield / transactionbodycustomfield / itemcustomfield / crmcustomfield /
// transactioncolumncustomfield / othercustomfield.
// Not exhaustive (customfieldfilters/roleaccesses nested elements are not supported here) —
// covers the common case of adding a field visible on a standard record with a label, type, and
// optional target subtypes.
//
// Two shapes exist: most categories take a set of "appliesto*"/"col*" boolean flags (target
// record/transaction subtypes). `other` is different — it takes a single `rectype` value instead
// (see `mode: "rectype"` below) — buildFieldXml.js branches on `def.mode` to handle both.
//
// Custom Record Custom Field is NOT a category here — it's not a standalone top-level SDF
// object. It's a <customrecordcustomfield> nested inside a <customrecordtype>'s own
// <customrecordcustomfields>, so it's handled by the Custom Record Type builder instead.

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
    // Confirmed live 2026-08-17: at least "appliestosalesorder" (hard error) and "appliestoinvoice"
    // (warning, non-blocking) get flagged "invalid or not supported" in this account. Kept in the
    // list since they're Oracle's documented names, but this category's flags are less trustworthy
    // than entity/item's (which validated clean) — re-test whichever specific flag you actually
    // need before relying on it, rather than assuming the whole list works.
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
  crm: {
    tag: "crmcustomfield",
    // Yes, custevent_ — NetSuite's own prefix for this object, not custcrm_.
    scriptidPrefix: "custevent_",
    description: "Custom field on CRM records (Campaign, Case, Event, Phone Call, Task, Project Task, Resource Allocation)",
    appliesTo: [
      "appliestocampaign",
      "appliestocase",
      "appliestoevent",
      "appliestophonecall",
      "appliestoprojecttask",
      "appliestotask",
      "appliesperkeyword",
      "appliestoresourceallocation",
    ],
  },
  transactionColumn: {
    tag: "transactioncolumncustomfield",
    scriptidPrefix: "custcol_",
    description: "Custom field on transaction line/column items (Sales, Purchase, Journal, Time, etc. line items)",
    appliesTo: [
      "colexpense",
      "colexpensereport",
      "colgrouponinvoices",
      "colinventoryadjustment",
      "colitemfulfillment",
      "colitemfulfillmentorder",
      "colitemreceipt",
      "colitemreceiptorder",
      "coljournal",
      "colkititem",
      "colopportunity",
      "colpackingslip",
      "colpickingticket",
      "colprintflag",
      "colpurchase",
      "colreturnform",
      "colsale",
      "colstore",
      "colstorehidden",
      "colstorewithgroups",
      "coltime",
      "coltransferorder",
    ],
  },
  other: {
    tag: "othercustomfield",
    scriptidPrefix: "custrecord_",
    description: "Custom field on 'other' record types that don't have a dedicated custom-field object (Account, Address, Department, Class, Location, etc.)",
    // Shape differs from the categories above: a single rectype value, not a
    // set of appliesto* booleans. Not exhaustive — add more as needed; NetSuite's
    // full list is under "generic_customrecordothercustomfield_rectype".
    mode: "rectype",
    rectypes: {
      account: -112,
      address: -289,
      department: -102,
      class: -101,
      location: -103,
    },
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
