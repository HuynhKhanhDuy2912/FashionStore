export const AVATAR_COLOR_CLASSES = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
];

export function getUserDisplayName(user, fallback = "User") {
  return user?.fullname || user?.username || user?.email || fallback;
}

export function getAvatarInitial(userOrName, fallback = "?") {
  const name =
    typeof userOrName === "string"
      ? userOrName
      : getUserDisplayName(userOrName, "");
  const firstChar = [...String(name || "").trim()].find((char) => char.trim());
  return firstChar ? firstChar.toLocaleUpperCase("vi-VN") : fallback;
}

export function getAvatarColorClass(seed = "") {
  const normalizedSeed = String(seed || "user");
  const total = [...normalizedSeed].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return AVATAR_COLOR_CLASSES[total % AVATAR_COLOR_CLASSES.length];
}
