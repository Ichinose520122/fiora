const fs = require('fs');
const path = require('path');

const packageRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.dirname(
        require.resolve('@neteasecloudmusicapienhanced/api/package.json'),
    );
const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
);
if (packageJson.version !== '4.40.1') {
    throw new Error(`Refusing to patch unsupported API ${packageJson.version}`);
}

function replaceOnce(relativePath, before, after) {
    const filename = path.join(packageRoot, relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const first = source.indexOf(before);
    if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
        throw new Error(`Expected one patch target in ${relativePath}`);
    }
    fs.writeFileSync(
        filename,
        source.slice(0, first) + after + source.slice(first + before.length),
    );
}

function replaceBlock(relativePath, startMarker, endMarker, replacement) {
    const filename = path.join(packageRoot, relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    if (start < 0 || end < 0) {
        throw new Error(`Expected patch block in ${relativePath}`);
    }
    fs.writeFileSync(
        filename,
        source.slice(0, start) + replacement + source.slice(end),
    );
}

const mobileSource = `const createOption = require('./option.js')
const { cookieToJson } = require('./index')
const { APP_CONF } = require('./config.json')

const MOBILE_LOGIN_PLATFORMS = new Set(['app', 'ios', 'iphone', 'mobile'])
const IOS_APPVER = '9.5.37'
const IOS_OSVER = '18.7.2'
const IOS_BUILDVER = '7010'
const IOS_USER_AGENT =
  'neteasemusic/' + IOS_APPVER + ' (iPhone; iOS ' + IOS_OSVER + '; Scale/3.00)'
const MOBILE_API_DOMAIN =
  APP_CONF.xeapiDomain || 'https://interface3.music.163.com'

const isMobilePlatform = (query = {}) => {
  const platform = String(query.platform || '').toLowerCase()
  return query.mobile === true || MOBILE_LOGIN_PLATFORMS.has(platform)
}

const normalizeCookie = (cookie) => {
  if (!cookie) return {}
  return typeof cookie === 'string' ? cookieToJson(cookie) : cookie
}

const createMobileEapiOption = (query = {}) => {
  const e_r = query.e_r === undefined ? true : query.e_r
  const option = createOption(
    {
      ...query,
      domain: query.domain || MOBILE_API_DOMAIN,
      e_r,
    },
    'eapi',
  )

  option.cookie = {
    ...normalizeCookie(option.cookie),
    os: 'iPhone OS',
    osver: IOS_OSVER,
    appver: IOS_APPVER,
    buildver: IOS_BUILDVER,
    channel: 'distribution',
  }
  option.domain = query.domain || MOBILE_API_DOMAIN
  option.ua = query.ua || IOS_USER_AGENT
  option.e_r = e_r
  option.emptyHeader = true
  option.mobileEapi = true
  option.headers = {
    ...option.headers,
    'content-type': 'application/x-www-form-urlencoded',
    'x-aeapi': 'true',
    'x-os': 'iPhone OS',
    'x-osver': IOS_OSVER,
    'x-appver': IOS_APPVER,
    'x-buildver': IOS_BUILDVER,
  }

  return option
}

module.exports = { createMobileEapiOption, isMobilePlatform }
`;

const captchaSource = `// 发送验证码

const createOption = require('../util/option.js')
const {
  createMobileEapiOption,
  isMobilePlatform,
} = require('../util/mobile.js')
module.exports = (query, request) => {
  if (isMobilePlatform(query)) {
    const data = {
      ctcode: query.ctcode || query.countrycode || '86',
      cellphone: query.phone,
      os: 'iOS',
      fromPage: query.fromPage || 'RN',
      rnBundleVersion: query.rnBundleVersion || '0.0.5',
      rnBundleName: query.rnBundleName || 'new-rn-login',
      verifyId: 1,
      e_r: query.e_r === undefined ? true : query.e_r,
    }
    return request('/api/sms/captcha/sent', data, createMobileEapiOption(query))
  }

  const data = {
    ctcode: query.ctcode || query.countrycode || '86',
    secrete: 'music_middleuser_pclogin',
    cellphone: query.phone,
  }
  return request('/api/sms/captcha/sent', data, createOption(query, 'weapi'))
}
`;

const loginSource = `// 手机登录

const CryptoJS = require('crypto-js')
const createOption = require('../util/option.js')
const {
  createMobileEapiOption,
  isMobilePlatform,
} = require('../util/mobile.js')
module.exports = async (query, request) => {
  const countrycode = query.countrycode || query.ctcode || '86'
  const data = {
    type: '1',
    https: 'true',
    phone: query.phone,
    countrycode,
    [query.captcha ? 'captcha' : 'password']: query.captcha
      ? query.captcha
      : query.md5_password || CryptoJS.MD5(query.password).toString(),
    remember: 'true',
    secureCaptcha: query.sca || '',
  }
  const mobile = isMobilePlatform(query)

  if (mobile) {
    data.rememberLogin = 'true'
    data.os = 'iOS'
    data.fromPage = query.fromPage || 'RN'
    data.rnBundleVersion = query.rnBundleVersion || '0.0.5'
    data.rnBundleName = query.rnBundleName || 'new-rn-login'
    data.verifyId = 1
    data.e_r = query.e_r === undefined ? true : query.e_r
  }

  let result = await request(
    mobile ? '/api/login/cellphone' : '/api/w/login/cellphone',
    data,
    mobile ? createMobileEapiOption(query) : createOption(query, 'weapi'),
  )

  if (result.body.code === 200) {
    result = {
      status: 200,
      body: {
        ...JSON.parse(
          JSON.stringify(result.body).replace(
            /avatarImgId_str/g,
            'avatarImgIdStr',
          ),
        ),
        cookie: result.cookie.join(';'),
      },
      cookie: result.cookie,
    }
  }
  return result
}
`;

fs.writeFileSync(path.join(packageRoot, 'util', 'mobile.js'), mobileSource);
fs.writeFileSync(path.join(packageRoot, 'module', 'captcha_sent.js'), captchaSource);
fs.writeFileSync(path.join(packageRoot, 'module', 'login_cellphone.js'), loginSource);

replaceOnce(
    'util/request.js',
    "  generateRandomChineseIP,\n} = require('./index')",
    "  generateRandomChineseIP,\n  generateDeviceId,\n} = require('./index')",
);
replaceOnce(
    'util/request.js',
    "  const os = osMap[cookie.os] || osMap['pc']\n\n  const processedCookie = {",
    "  const os = osMap[cookie.os] || osMap['pc']\n" +
        "  const normalizedOs = osMap[cookie.os] ? os.os : cookie.os || os.os\n" +
        '  const deviceId = cookie.deviceId || global.deviceId || generateDeviceId()\n' +
        '  global.deviceId = deviceId\n\n' +
        '  const processedCookie = {',
);
replaceOnce(
    'util/request.js',
    "    deviceId: cookie.deviceId || global.deviceId,\n" +
        "    os: cookie.os || os.os,\n" +
        "    channel: cookie.channel || os.channel,\n" +
        "    appver: cookie.appver || os.appver,",
    "    deviceId,\n" +
        "    sDeviceId: cookie.sDeviceId || cookie.sdeviceid || deviceId,\n" +
        "    os: normalizedOs,\n" +
        "    channel: cookie.channel || os.channel,\n" +
        "    appver: cookie.appver || os.appver,\n" +
        "    buildver: cookie.buildver || os.buildver,",
);
replaceOnce(
    'util/request.js',
    "        if (crypto === 'eapi') {\n" +
        "          // headers['x-aeapi'] = true // 服务器会使用gzip压缩返回值\n" +
        '          data.header = header',
    "        if (crypto === 'eapi') {\n" +
        "          if (cookie.deviceId) {\n" +
        "            headers['x-deviceid'] = headers['x-deviceid'] || cookie.deviceId\n" +
        "            headers['x-sdeviceid'] =\n" +
        "              headers['x-sdeviceid'] || cookie.sDeviceId || cookie.deviceId\n" +
        "          }\n" +
        "          headers['x-os'] = headers['x-os'] || cookie.os\n" +
        "          headers['x-osver'] = headers['x-osver'] || cookie.osver\n" +
        "          headers['x-appver'] = headers['x-appver'] || cookie.appver\n" +
        "          headers['x-buildver'] = headers['x-buildver'] || header.buildver\n" +
        "          if (cookie.MUSIC_U) headers['x-music-u'] = cookie.MUSIC_U\n" +
        "          if (options.mobileEapi && cookie.deviceId && !data.deviceId) {\n" +
        "            data.deviceId = cookie.deviceId\n" +
        "          }\n" +
        '          data.header = options.emptyHeader ? {} : header',
);

replaceBlock(
    'util/crypto.js',
    'const eapiResDecrypt = (encryptedParams, aeapi = false) => {',
    'const eapiReqDecrypt = (encryptedParams) => {',
    `const eapiResDecrypt = (encryptedParams, aeapi = false) => {
  const maybeGunzip = (buffer) => {
    if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return zlib.gunzipSync(buffer)
    }
    return buffer
  }

  try {
    let encryptedBuffer = Buffer.from(encryptedParams, 'hex')
    if (aeapi) encryptedBuffer = maybeGunzip(encryptedBuffer)

    const decrypted = aesDecrypt(
      encryptedBuffer.toString('hex'),
      'ecb',
      eapiKey,
      '',
      'hex',
    )
    let decryptedBuffer = Buffer.from(
      decrypted.toString(CryptoJS.enc.Base64),
      'base64',
    )
    if (aeapi) decryptedBuffer = maybeGunzip(decryptedBuffer)

    return JSON.parse(decryptedBuffer.toString())
  } catch (error) {
    console.log('eapiResDecrypt error:', error)
    return null
  }
}
`,
);
