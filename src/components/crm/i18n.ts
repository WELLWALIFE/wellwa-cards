// Every word the CRM Pro screens show, Hindi first (the owner's customers' language), English on the app's EN toggle.
// Use: const L = useCrmT(); L.today — never a bare English string in a CRM Pro component (owner's rule, 21 Oct 2026).
import { useT } from "@/lib/poster-i18n";

const STR = {
  hi: {
    today: "आज", customers: "ग्राहक", calendar: "कैलेंडर", reports: "रिपोर्ट", settings: "सेटिंग",
    greeting: (n: string) => (n ? `नमस्ते ${n} जी` : "नमस्ते"), startCalling: (n: number) => `Call शुरू करें (${n})`,
    overdue: "बाकी रह गए", dueToday: "आज के follow-up", unreadChats: "बिना पढ़े message", freshLeads: "नए lead (बात नहीं हुई)", todaysBookings: "आज की booking",
    callbacks: "Call back माँगा है", goingCold: "ठंडे पड़ रहे", allClear: "आज सब हो गया 🎉 — नए lead आते ही यहाँ दिखेंगे।",
    due: "Follow-up", unread: "Unread", fresh: "नए", hot: "Hot", called: "आज call", target: "लक्ष्य",
    call: "Call", whatsapp: "WhatsApp", done: "हो गया", task: "Task", note: "Note", book: "Booking", pay: "Payment", more: "और",
    skip: "छोड़ें", next: "अगला", back: "वापस", save: "सेव करें", cancel: "रद्द", delete: "हटाएँ", edit: "बदलें", close: "बंद", add: "जोड़ें",
    search: "नाम, नंबर, tag खोजें…", all: "सभी", mine: "मेरे", unassigned: "किसी को नहीं", noLeads: "अभी कोई ग्राहक नहीं। + से जोड़ें या card share करें।", nothing: "इस filter में कुछ नहीं।", loadMore: "और दिखाएँ",
    sort: "क्रम", sortActivity: "हाल की activity", sortNewest: "सबसे नए", sortFollowup: "follow-up", sortValue: "deal value", sortScore: "AI score",
    filterDue: "follow-up बाकी", filterIdle: "7 दिन से चुप", lifecycle: "स्थिति", lead: "Lead", customer: "ग्राहक", lost: "गया",
    list: "List", pipeline: "Pipeline",
    chat: "Chat", activity: "Activity", details: "Details", sales: "बिक्री",
    stage: "Stage", assigned: "किसे दिया", nobody: "किसी को नहीं (मैं)", tags: "Tags", addTag: "+ tag", dealValue: "Deal value", followUp: "Follow-up", notes: "Notes", notesPh: "इस ग्राहक के बारे में याद रखने वाली बात",
    name: "नाम", phone: "मोबाइल", altPhone: "दूसरा नंबर", business: "दुकान / कंपनी", city: "शहर", address: "पता", pincode: "Pincode", birthday: "जन्मदिन", anniversary: "सालगिरह", langPref: "ग्राहक की भाषा", products: "किस product में रुचि", budget: "बजट ₹", email: "Email", source: "कहाँ से आया", lostReason: "क्यों नहीं बना",
    timeline: "Timeline", noActivity: "अभी कोई activity नहीं।", messages: (n: number) => `${n} message`, tlAll: "सब", tlCalls: "Calls", tlChats: "Chats", tlTasks: "Tasks", tlNotes: "Notes",
    nextAction: "अगला काम", noNext: "कोई follow-up नहीं — एक लगाएँ", snooze: "टालें", snooze1h: "1 घंटा", snoozeTomorrow: "कल 11 बजे",
    newTask: "नया task", taskKind: "किस तरह का", kCall: "Call", kWhatsapp: "WhatsApp", kVisit: "Visit", kMeeting: "Meeting", kOther: "और कुछ", taskTitle: "क्या करना है", taskTitlePh: "जैसे: price बताना है", when: "कब", quickToday6: "आज 6 बजे", quickTomorrow11: "कल 11 बजे", quick3d: "3 दिन में", quickWeek: "अगले हफ़्ते", pick: "तारीख चुनें",
    openTasks: "बाकी tasks", doneTasks: "हो चुके",
    callOutcome: "Call कैसी रही?", connected: "बात हुई", noAnswer: "नहीं उठाया", busy: "Busy", switchedOff: "बंद था", wrongNumber: "गलत नंबर", callBack: "बाद में call", duration: "कितनी देर", callNote: "क्या बात हुई", callNotePh: "जैसे: demo Sunday को, price पूछा", speak: "बोलकर लिखें", listening: "सुन रहा हूँ…",
    nextStep: "अगला step", sendWa: "अभी WhatsApp भेजें", waMissedYou: "\"call किया था\" message", moveStage: "Stage बदलें", saveCall: "Call सेव करें", callLogged: "Call सेव हो गई", dialHint: "अपने फ़ोन से call करें:", copied: "Copy हो गया",
    callList: "Call list", callListEmpty: "अभी कोई call बाकी नहीं 👍", talkingPoints: "बात के points", lastMessages: "पिछले message",
    calendarEmpty: "इस दिन कुछ नहीं।", bookings: "Bookings", tasks: "Tasks",
    stCalling: "Calling", stAskOutcome: "Call के बाद पूछें \"क्या हुआ?\"", stRetry: "नहीं उठाया → इतने मिनट बाद फिर call याद दिलाएँ", stMissedWa: "नहीं उठाया → यह WhatsApp भेज दो", stTarget: "रोज़ के call का लक्ष्य (0 = नहीं)",
    stTeam: "Team inbox", stTemplates: "Quick replies", stBot: "Menu bot", stIntegrations: "Integrations", stImport: "Leads import", stExport: "CSV export", stJoin: "किसी की team join करें", stAutomations: "Automations", stAutoSoon: "बाकी automations (नए lead पर task, birthday wish, रोज़ की summary) अगले update में।",
    saved: "सेव हो गया", failed: "नहीं हो पाया। फिर से कोशिश करें।", offline: "Internet नहीं चल रहा।",
    addLead: "ग्राहक जोड़ें", waNotLinked: "WhatsApp link नहीं है — WhatsApp tab से link करें।", openWa: "WhatsApp app में खोलें",
    ago: { now: "अभी", yesterday: "कल" }, overdueTag: "बाकी", todayTag: "आज",
    scoreHint: "AI score", won: "बिका", convertedHint: "Won करते ही review माँगने वाला message जाता है (settings में बंद कर सकते हैं)।",
    deleteLead: "इस ग्राहक को हटाएँ? chat और सारी history चली जाएगी।", optOut: "Messages बंद (opt-out)", merge: "Duplicate मिलाएँ (जल्द)",
    reportsHint: "पिछले 30 दिन की रिपोर्ट।", callsReport: "Calls", callsMade: "किए", callsConnected: "बात हुई", avgDuration: "औसत समय",
  },
  en: {
    today: "Today", customers: "Customers", calendar: "Calendar", reports: "Reports", settings: "Settings",
    greeting: (n: string) => (n ? `Hello ${n}` : "Hello"), startCalling: (n: number) => `Start calling (${n})`,
    overdue: "Overdue", dueToday: "Due today", unreadChats: "Unread chats", freshLeads: "New leads, untouched", todaysBookings: "Today's bookings",
    callbacks: "Asked for a call back", goingCold: "Going cold", allClear: "All done for today 🎉 — new leads show up here.",
    due: "Follow-ups", unread: "Unread", fresh: "New", hot: "Hot", called: "Called today", target: "target",
    call: "Call", whatsapp: "WhatsApp", done: "Done", task: "Task", note: "Note", book: "Booking", pay: "Payment", more: "More",
    skip: "Skip", next: "Next", back: "Back", save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", close: "Close", add: "Add",
    search: "Search name, number, tag…", all: "All", mine: "Mine", unassigned: "Unassigned", noLeads: "No customers yet. Add one with + or share your card.", nothing: "Nothing matches this filter.", loadMore: "Show more",
    sort: "Sort", sortActivity: "Recent activity", sortNewest: "Newest", sortFollowup: "Follow-up", sortValue: "Deal value", sortScore: "AI score",
    filterDue: "Follow-up due", filterIdle: "Quiet 7 days", lifecycle: "Status", lead: "Lead", customer: "Customer", lost: "Lost",
    list: "List", pipeline: "Pipeline",
    chat: "Chat", activity: "Activity", details: "Details", sales: "Sales",
    stage: "Stage", assigned: "Assigned to", nobody: "Nobody (me)", tags: "Tags", addTag: "+ tag", dealValue: "Deal value", followUp: "Follow-up", notes: "Notes", notesPh: "Anything to remember about this customer",
    name: "Name", phone: "Mobile", altPhone: "Other number", business: "Shop / company", city: "City", address: "Address", pincode: "Pincode", birthday: "Birthday", anniversary: "Anniversary", langPref: "Customer's language", products: "Interested in", budget: "Budget ₹", email: "Email", source: "Source", lostReason: "Lost reason",
    timeline: "Timeline", noActivity: "No activity yet.", messages: (n: number) => `${n} message${n === 1 ? "" : "s"}`, tlAll: "All", tlCalls: "Calls", tlChats: "Chats", tlTasks: "Tasks", tlNotes: "Notes",
    nextAction: "Next action", noNext: "No follow-up — set one", snooze: "Snooze", snooze1h: "1 hour", snoozeTomorrow: "Tomorrow 11 am",
    newTask: "New task", taskKind: "Kind", kCall: "Call", kWhatsapp: "WhatsApp", kVisit: "Visit", kMeeting: "Meeting", kOther: "Other", taskTitle: "What to do", taskTitlePh: "e.g. share the price list", when: "When", quickToday6: "Today 6 pm", quickTomorrow11: "Tomorrow 11 am", quick3d: "In 3 days", quickWeek: "Next week", pick: "Pick date",
    openTasks: "Open tasks", doneTasks: "Done",
    callOutcome: "How did the call go?", connected: "Connected", noAnswer: "No answer", busy: "Busy", switchedOff: "Switched off", wrongNumber: "Wrong number", callBack: "Call back later", duration: "Duration", callNote: "What was said", callNotePh: "e.g. demo on Sunday, asked the price", speak: "Speak", listening: "Listening…",
    nextStep: "Next step", sendWa: "Send a WhatsApp now", waMissedYou: "\"Tried calling you\" message", moveStage: "Change stage", saveCall: "Save call", callLogged: "Call saved", dialHint: "Dial on your phone:", copied: "Copied",
    callList: "Call list", callListEmpty: "No calls pending 👍", talkingPoints: "Talking points", lastMessages: "Last messages",
    calendarEmpty: "Nothing on this day.", bookings: "Bookings", tasks: "Tasks",
    stCalling: "Calling", stAskOutcome: "After a call, ask me what happened", stRetry: "No answer → remind me to call again after (minutes)", stMissedWa: "No answer → send this WhatsApp", stTarget: "Daily call target (0 = off)",
    stTeam: "Team inbox", stTemplates: "Quick replies", stBot: "Menu bot", stIntegrations: "Integrations", stImport: "Import leads", stExport: "Export CSV", stJoin: "Join a team", stAutomations: "Automations", stAutoSoon: "More automations (task on new lead, birthday wish, daily summary) come in the next update.",
    saved: "Saved", failed: "Could not save. Please try again.", offline: "No internet.",
    addLead: "Add customer", waNotLinked: "WhatsApp is not linked — link it on the WhatsApp tab.", openWa: "Open in WhatsApp app",
    ago: { now: "now", yesterday: "Yesterday" }, overdueTag: "overdue", todayTag: "today",
    scoreHint: "AI score", won: "Won", convertedHint: "Marking Won sends the review-ask message (switch it off in settings).",
    deleteLead: "Delete this customer? The chat and all history go with it.", optOut: "Stop messages (opt-out)", merge: "Merge duplicate (soon)",
    reportsHint: "Last 30 days.", callsReport: "Calls", callsMade: "made", callsConnected: "connected", avgDuration: "avg. duration",
  },
};
export type CrmStrings = typeof STR.hi;
export function useCrmT(): CrmStrings & { lang: "hi" | "en"; hi: boolean } {
  const { lang } = useT();
  return { ...(lang === "en" ? (STR.en as CrmStrings) : STR.hi), lang: lang === "en" ? "en" : "hi", hi: lang !== "en" };
}
export const STAGE_LABEL: Record<string, { hi: string; en: string }> = {
  new: { hi: "नया", en: "New" }, contacted: { hi: "बात हुई", en: "Contacted" }, interested: { hi: "रुचि है", en: "Interested" }, follow_up: { hi: "Follow-up", en: "Follow-up" }, converted: { hi: "बिका", en: "Won" }, lost: { hi: "गया", en: "Lost" },
};
export const OUTCOME_LABEL: Record<string, { hi: string; en: string }> = {
  connected: { hi: "बात हुई", en: "Connected" }, no_answer: { hi: "नहीं उठाया", en: "No answer" }, busy: { hi: "Busy", en: "Busy" }, switched_off: { hi: "बंद था", en: "Switched off" }, wrong_number: { hi: "गलत नंबर", en: "Wrong number" }, call_back: { hi: "बाद में call", en: "Call back later" }, unknown: { hi: "Call", en: "Call" },
};
