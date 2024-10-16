const {app, BrowserWindow, ipcMain, dialog} = require('electron')
const { autoUpdater } = require('electron-updater');
const path = require('path')
const url = require('url')
const os = require('os');
const { exec } = require('child_process');

// 跨平台获取硬件序列号
function getSerialNumber() {
  return new Promise((resolve, reject) => {
    const platform = os.platform();

    let command;
    if (platform === 'win32') {
      command = 'wmic bios get serialnumber';
    } else if (platform === 'darwin') {
      command = 'ioreg -l | grep IOPlatformSerialNumber';
    } else if (platform === 'linux') {
      command = 'cat /proc/cpuinfo | grep Serial';
    } else {
      reject(new Error('Unsupported platform'));
      return;
    }

    exec(command, (error, stdout, stderr) => {
      if (error || stderr) {
        reject(error || stderr);
        return;
      }

      let serialNumber;
      if (platform === 'win32') {
        serialNumber = stdout.split('\n')[1].trim();
      } else if (platform === 'darwin') {
        serialNumber = stdout.split('"')[3];
      } else if (platform === 'linux') {
        serialNumber = stdout.split(':')[1].trim();
      }
      resolve(serialNumber);
    });
  });
}

// getSerialNumber()
//   .then(serialNumber => {
//     console.log('Device Serial Number:', serialNumber);
//   })
//   .catch(err => {
//     console.error('Error getting Device Serial Number:', err);
//   });
 
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
 
async function createWindow () {
  // 获取设备序列号
  let serial = ''
  try{
    const serialNumber = await getSerialNumber()
    console.log('Device Serial Number:', serialNumber);
    serial = serialNumber
  }catch(err){
    //TODO handle the exception
    console.error('Error getting Device Serial Number:', err);
  }
  
  // 从命令行获取参数
  const args = process.argv.slice(1);
  let deviceId = '';
  let screenId = '';

  // 解析 deviceid 和 screenid 参数
  args.forEach((arg, index) => {
    if (arg === '--deviceid') {
      deviceId = args[index + 1];
    }
    if (arg === '--screenid') {
      screenId = args[index + 1];
    }
  });
  // 判断启动应用是否有参数，没有参数使用设备序号
  if (!deviceId && serial) {
    deviceId = serial
    screenId = `${deviceId}_1`
  }
  
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,  // 启动时全屏
    frame: false,  // 无边框
    autoHideMenuBar: true,  // 隐藏菜单栏
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,  // 确保可以在渲染进程中使用 ipcRenderer
    }
  })
 
  // and load the index.html of the app.
  // 构建带参数的本地文件路径
  const localUrl = url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
    hash: `/?deviceid=${deviceId}&screenid=${screenId}`  // 使用 hash
  });

  // 加载本地 HTML 文件
  win.loadURL(localUrl);
  
  // 监听全屏切换事件
  ipcMain.on('toggle-fullscreen', (event, isFullScreen) => {
    win.setFullScreen(isFullScreen);  // 根据 isFullScreen 值设置全屏或退出全屏
  });
 
  // Open the DevTools.
  // win.webContents.openDevTools()
 
  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}
 
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow()
  // 自动检查更新
  autoUpdater.checkForUpdatesAndNotify();
})

// 当更新可用时提示用户
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update available',
    message: 'A new version of the app is available. Downloading now...'
  });
});

// 更新下载完成后，提示用户是否立即更新
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version of the app has been downloaded. Quit and install now?',
    buttons: ['Yes', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// 错误处理
autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString());
});
 
// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
 
app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})
 
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.