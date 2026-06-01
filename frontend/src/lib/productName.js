export function formatProductName(name = "") {
  return String(name || "")
    .trim()
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, prefix, letter) => {
      return `${prefix}${letter.toLocaleUpperCase("vi-VN")}`;
    });
}

export function formatProductMessage(name = "") {
  return formatProductName(name);
}
