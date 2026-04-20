export function getWeatherIcon(code: number, isDay: number): string {
  if (!isDay) {
    if ([1063, 1180, 1183, 1186, 1189, 1192, 1195].includes(code)) return 'night-rain';
    return 'night';
  }
  if (code === 1000) return 'sunny';
  if ([1003, 1006].includes(code)) return 'partly-cloudy';
  if ([1009, 1030].includes(code)) return 'cloudy';
  if ([1135, 1147].includes(code)) return 'fog';
  if (
    [
      1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243,
      1246,
    ].includes(code)
  )
    return 'rain';
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'thunder';
  if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code))
    return 'snow';
  return 'cloudy';
}
