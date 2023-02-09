// 0 => 0000-0000
export const pretty_id = (id: string | number) => {
  const digits = pad(id, 8);
  return digits.slice(0, 4) + '-' + digits.slice(4, 8);
};

export const pretty_id_without_bar = (id: string | number) => {
  const digits = pad(id, 8);
  return digits.slice(0, 4) + '' + digits.slice(4, 8);
};

export function pad(num: string | number, size: number): string {
  let s = num + '';
  while (s.length < size) s = '0' + s;
  return s;
}

// 0000-0000 => 0
export const parse_pretty_id = (str: string): number | null => {
  if (typeof str != 'string' || str.length < 8) {
    return null;
  }
  str = str.replace('-', '');
  if (str.length !== 8) {
    return null;
  }
  let id: number | null = parseInt(str);
  if (isNaN(id)) {
    id = null;
  }
  return id;
};
