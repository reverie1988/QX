const scriptName = 'PingMe';
const storeKey = 'pingme_accounts_v1';

$prefs.removeValueForKey(storeKey);

$notify(scriptName, '✅ 已清空账号数据', `已删除 QX $prefs 中的 ${storeKey}`);
console.log(`【${scriptName}】已删除 ${storeKey}`);

$done();

