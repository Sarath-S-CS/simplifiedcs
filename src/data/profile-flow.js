// Groups unscored "profile" nodes into named screens - the graph-native
// replacement for PRE_STEPS. Each screen wraps its own small graph (so
// team-structure's branching/dedupe still works), and the UI renders every
// currently-visible node in a screen together with progressive reveal as
// answers come in - the same chunked-screen UX the original PRE_STEPS had,
// just now backed by a real graph instead of a fixed field array.
import { buildFlow } from "../engine/graph.js";
import { ORG_PROFILE_ORDER, ORG_PROFILE_NODES, INFRA_ORDER, INFRA_NODES, DEVSEC_ORDER, DEVSEC_NODES, OT_ORDER, OT_NODES, otSectionSkipped } from "./profile-questions.js";
import { TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES } from "./team-structure.js";
import { CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES } from "./containerization.js";

export const PROFILE_SCREENS = [
  {
    id: "profile",
    title: "Organization Profile",
    sub: "Scale changes what's realistic to recommend - a 10-person firm and a 2,000-person firm shouldn't get the same advice.",
    flow: buildFlow(ORG_PROFILE_ORDER, ORG_PROFILE_NODES),
  },
  {
    id: "team",
    title: "Your Team & Vendors",
    sub: "Who owns cybersecurity day to day, and how - this shapes which follow-up questions actually apply to you.",
    flow: buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES),
  },
  {
    id: "infra",
    title: "Technology & Infrastructure",
    sub: "The specific products and architecture in place - this is what lets recommendations reference your actual stack instead of speaking generically.",
    flow: buildFlow(INFRA_ORDER, INFRA_NODES),
  },
  {
    id: "containerization",
    title: "Containerization & Virtualization",
    sub: "Applies to any use of containers or VMs - file servers and intranet sites count, not just custom applications.",
    flow: buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES),
  },
  {
    id: "devsecops",
    title: "Software Delivery & DevSecOps",
    sub: "Only applicable if you build software - the first question determines whether the rest of this screen applies.",
    flow: buildFlow(DEVSEC_ORDER, DEVSEC_NODES),
  },
  {
    id: "ot",
    title: "Operational Technology (OT)",
    sub: "Industrial control systems and SCADA run on a different risk model than office IT - this section only applies if one exists.",
    flow: buildFlow(OT_ORDER, OT_NODES),
    skipIf: otSectionSkipped,
  },
];
