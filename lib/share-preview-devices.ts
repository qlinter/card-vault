export const sharePreviewDevices = [
  { id: "desktop", label: "桌面", width: 1440 },
  { id: "tablet", label: "平板", width: 768 },
  { id: "mobile", label: "手机", width: 390 }
] as const;

export type SharePreviewDeviceId = (typeof sharePreviewDevices)[number]["id"];

export function getSharePreviewDevice(value: unknown) {
  return sharePreviewDevices.find((device) => device.id === value) ?? sharePreviewDevices[0];
}
