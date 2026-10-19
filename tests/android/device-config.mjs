import path from 'node:path';
export const serial=process.env.PAPER_ANDROID_SERIAL;
export const port=Number(process.env.PAPER_ADB_PORT||5037);
if(!serial)throw Error('请设置 PAPER_ANDROID_SERIAL，明确指定用于测试的模拟器；测试会创建和删除示例数据。');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PAPER_ADB_PORT 必须是有效端口号。');
const sdk=process.env.ANDROID_SDK_ROOT||path.resolve('.toolchain/android-sdk');
export const adb=process.env.PAPER_ADB||path.join(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb');
export const args=['-P',String(port),'-s',serial];
