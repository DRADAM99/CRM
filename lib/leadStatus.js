export const leadStatusConfig = {
  "חדש": { color: "bg-red-500", priority: 1 },
  "נקבעה שיחה": { color: "bg-pink-500", priority: 2 },
  "בבדיקת לקוח": { color: "bg-orange-500", priority: 2 },
  "ממתין לתשובה של ד״ר וינטר": { color: "bg-purple-500", priority: 3 },
  "נקבע יעוץ": { color: "bg-green-500", priority: 4 },
  "בסדרת טיפולים": { color: "bg-emerald-400", priority: 6 },
  "באג": { color: "bg-yellow-900", priority: 5 },
  "לא מתאים": { color: "bg-gray-400", priority: 7 },
  "אין מענה": { color: "bg-yellow-500", priority: 5 },
  "קורס": { color: "bg-blue-900", priority: 8 },
  "ניתן מענה": { color: "bg-gray-500", priority: 9 },
  Default: { color: "bg-gray-300", priority: 99 }
};

export const leadColorTab = (status) => leadStatusConfig[status]?.color || leadStatusConfig.Default.color;
export const leadPriorityValue = (status) => leadStatusConfig[status]?.priority || leadStatusConfig.Default.priority;


