const { ipcMain } = require('electron');

function registerWeatherIPC() {
  ipcMain.handle('get-weather', async () => {
    try {
      const res = await fetch(
        'https://api.weatherapi.com/v1/current.json?key=63b08ba24dc24f48872162231260904&q=Manama',
      );

      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Weather API error:', error);
      return { error: 'Failed to fetch weather' };
    }
  });
}

module.exports = registerWeatherIPC;
