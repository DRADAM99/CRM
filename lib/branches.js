export const BRANCHES = [
  { value: '', label: 'ללא סניף', color: 'bg-gray-200 text-gray-700' },
  { value: 'רעננה', label: 'רעננה', color: 'bg-green-200 text-green-800' },
  { value: 'מודיעין', label: 'מודיעין', color: 'bg-blue-200 text-blue-800' },
  { value: 'עין-דור', label: 'עין-דור', color: 'bg-purple-200 text-purple-800' },
];

export function branchColor(branch) {
  const found = BRANCHES.find(b => b.value === branch);
  return found ? found.color : 'bg-gray-200 text-gray-700';
}


