export function getDynamicGreeting(): string {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  if (currentHour >= 4 && currentHour < 11) return 'Selamat Pagi';
  if (currentHour >= 11 && currentHour < 15) return 'Selamat Siang';
  if (currentHour >= 15 && currentHour < 18.5) return 'Selamat Sore';
  return 'Selamat Malam';
}
