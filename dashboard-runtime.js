(function (win, doc) {
  'use strict';

  var settings = {
    fallbackData: 'data.js',
    endpointPointer: 'live-endpoint.js',
    pollEvery: 3 * 60 * 1000,
    pollOffset: 5000,
    quietStart: 3,
    quietEnd: 8
  };
  var state = {
    endpoint: win.DASH_LIVE_ENDPOINT || settings.fallbackData,
    latest: null,
    renderedAt: ''
  };
  var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  var ui = {
    find: function (id) { return doc.getElementById(id); },
    textNode: function (node, value) {
      var next = String(value);
      if (node && node.textContent !== next) node.textContent = next;
    },
    text: function (id, value) {
      ui.textNode(ui.find(id), value);
    },
    html: function (node, value) {
      if (node && node.innerHTML !== value) node.innerHTML = value;
    },
    className: function (node, value) {
      if (node && node.className !== value) node.className = value;
    },
    style: function (node, name, value) {
      if (node && node.style[name] !== value) node.style[name] = value;
    },
    attribute: function (node, name, value) {
      var next = String(value);
      if (node && node.getAttribute(name) !== next) node.setAttribute(name, next);
    }
  };

  function twoDigits(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function timestamp(value) {
    var parsed = Date.parse(value || '');
    return isNaN(parsed) ? 0 : parsed;
  }

  function clockText(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return '--:--';
    return twoDigits(date.getHours()) + ':' + twoDigits(date.getMinutes());
  }

  function isQuiet(date) {
    var hour = (date || new Date()).getHours();
    return hour >= settings.quietStart && hour < settings.quietEnd;
  }

  function millisecondsUntilMorning(date) {
    var now = date || new Date();
    var morning = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      settings.quietEnd, 0, 5, 0
    );
    return Math.max(1000, morning.getTime() - now.getTime());
  }

  function updateFreshness() {
    var lastUpdate = state.latest && state.latest.updatedAt;
    var age = lastUpdate
      ? Math.floor((Date.now() - timestamp(lastUpdate)) / 60000)
      : 99999;
    var lastClock = clockText(lastUpdate);
    var status = ui.find('dataStatus');
    var alert = ui.find('dataAlert');

    if (isQuiet()) {
      ui.textNode(status, '夜间省电 · 08:00 恢复');
      ui.className(status, '');
      ui.textNode(alert, '');
      ui.className(alert, 'data-alert');
      return;
    }

    if (!state.latest || age > 15) {
      ui.textNode(status, '离线 · 最后 ' + lastClock);
      ui.className(status, 'warn');
      ui.textNode(alert, '电脑或数据链路已离线 · 最后在线 ' + lastClock);
      ui.className(alert, 'data-alert on');
      return;
    }

    if (age >= 7) {
      ui.textNode(status, '延迟 ' + age + ' 分钟 · ' + lastClock);
      ui.className(status, 'warn');
      ui.textNode(alert, '实时数据延迟 ' + age + ' 分钟 · 正在显示最后一次结果');
      ui.className(alert, 'data-alert on');
      return;
    }

    ui.textNode(status, '实时 · ' + lastClock);
    ui.className(status, '');
    ui.textNode(alert, '');
    ui.className(alert, 'data-alert');
  }

  function updateClock() {
    // 时区安全: 从 ISO 字符串直接抽时:分 (数据时间是 +08:00 北京)
    var last = state.latest && state.latest.updatedAt;
    var now = new Date();
    var h = '--', m = '--', dateText = '', wk = '';
    if (last) {
      var t = last.match(/T(\d{2}):(\d{2}):/);
      var d = last.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (t) { h = t[1]; m = t[2]; }
      if (d) { dateText = parseInt(d[1]) + '年' + parseInt(d[2]) + '月' + parseInt(d[3]) + '日'; wk = weekdays[new Date(last).getDay()]; }
    }
    ui.text('dtTime', h + ':' + m);
    ui.text('dtDate', dateText);
    ui.text('dtWeek', wk);
    // 副显 Kindle 本地时钟
    ui.text('dtLocal', twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()));
    updateFreshness();
  }

  function queryValue(name) {
    var match = String(location.search || '').match(
      new RegExp('[?&]' + name + '=([^&]*)')
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function updateBattery() {
    var percentText = queryValue('battery');
    var chargeText = queryValue('charging');
    var percent = percentText !== null ? Number(percentText) : null;
    var charging = chargeText === '1';
    var device = win.KINDLE_DEVICE;

    if (device) {
      if (typeof device.battery === 'number') percent = device.battery;
      if (typeof device.charging === 'boolean') charging = device.charging;
      if (device.charging === 0 || device.charging === 1) charging = device.charging === 1;
    }
    if (percent === null || isNaN(percent)) return;

    percent = Math.max(0, Math.min(100, percent));
    ui.text('batPct', (charging ? '⚡ ' : '') + percent + '%');
    ui.attribute(ui.find('batFill'), 'width', Math.round(18 * percent / 100));
  }

  function attachScript(url, onSuccess, onFailure) {
    var script = doc.createElement('script');
    script.async = true;
    script.src = url;
    script.onload = function () {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (onSuccess) onSuccess();
    };
    script.onerror = function () {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (onFailure) onFailure();
    };
    doc.getElementsByTagName('head')[0].appendChild(script);
  }

  function requestDeviceStatus() {
    attachScript('device-status.js?_=' + Date.now(), updateBattery);
  }

  function selectWeatherIcon(key, description) {
    var text = (String(key || '') + ' ' + String(description || '')).toLowerCase();
    if (/thunder|雷/.test(text)) return 'ϟ';
    if (/snow|雪/.test(text)) return '❄';
    if (/rain|wet|雨/.test(text)) return '☂';
    if (/fog|mist|haze|雾/.test(text)) return '≋';
    if (/clear|sun|晴/.test(text)) return '☀';
    return '☁';
  }

  function formatTokenCount(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return '--';
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
    return String(Math.round(n));
  }

  function updateWeather(weather) {
    if (!weather || !weather.ok) {
      ui.text('weatherTemp', '--°');
      ui.text('weatherIcon', '○');
      ui.text('weatherDesc', '天气未配置');
      ui.text('weatherSub', '等待下次采集');
      return;
    }
    ui.text('weatherTemp', Math.round(Number(weather.tempC)) + '°');
    ui.text('weatherIcon', selectWeatherIcon(weather.iconKey, weather.description));
    ui.text('weatherDesc', String(weather.description || '天气'));
    var feels = weather.feelsLikeC != null ? '体感 ' + Math.round(weather.feelsLikeC) + '°' : '';
    var hum = weather.humidity != null ? '湿度 ' + Math.round(weather.humidity) + '%' : '';
    var wind = weather.windKph != null ? '风 ' + Math.round(weather.windKph) + 'km/h' : '';
    var place = weather.place ? '· ' + weather.place : '';
    var sub = [feels, hum, wind + (place ? ' ' + place : '')].filter(Boolean).join(' · ');
    ui.text('weatherSub', sub || ' ');
  }

  function remainingText(value) {
    var remaining = timestamp(value) - Date.now();
    if (!value || !remaining) return '';
    if (remaining <= 0) return '↻ 即将刷新';
    var minutes = Math.ceil(remaining / 60000);
    var days = Math.floor(minutes / 1440);
    var hours = Math.floor((minutes % 1440) / 60);
    minutes %= 60;
    if (days) return '↻ ' + days + 'd' + (hours ? ' ' + hours + 'h' : '');
    if (hours) return '↻ ' + hours + 'h' + twoDigits(minutes) + 'm';
    return '↻ ' + minutes + 'm';
  }

  function windowLabel(name) {
    var text = String(name || '');
    if (/5小时|5H/i.test(text)) return { id: 'w5hPct', fill: 'w5h' };
    if (/7天|周|WEEK/i.test(text)) return { id: 'wwPct', fill: 'ww' };
    if (/月|MONTH/i.test(text)) return { id: 'wmPct', fill: 'wm' };
    return null;
  }

  function updateMainCard(source) {
    if (!source || !source.ok) {
      ui.text('mPctNum', '--');
      ui.text('mPctText', '--%');
      ui.text('mPlanName', '等待数据');
      ui.text('mPctSub', '实时');
      ui.style(ui.find('mBarFill'), 'width', '0%');
      ['w5hPct', 'wwPct', 'wmPct'].forEach(function (id) {
        ui.text(id, '--%');
      });
      var emptyFills = doc.querySelectorAll('[data-fill]');
      for (var i = 0; i < emptyFills.length; i += 1) {
        ui.style(emptyFills[i], 'width', '0%');
      }
      return;
    }

    var pct = Math.max(0, Math.min(100, Number(source.pct) || 0));
    ui.text('mPctNum', String(Math.round(pct)));
    ui.text('mPctText', String(Math.round(pct)) + '%');
    ui.text('mPlanName', String(source.planName || source.label || 'Token Plan'));
    ui.style(ui.find('mBarFill'), 'width', pct + '%');
    ui.text('mPctSub', '实时');

    var windows = Array.isArray(source.windows) ? source.windows : [];
    var usedFills = {};
    for (var w = 0; w < windows.length; w += 1) {
      var win = windows[w];
      var slot = windowLabel(win.name);
      if (!slot) continue;
      var wPct = Math.max(0, Math.min(100, Number(win.usedPct) || 0));
      ui.text(slot.id, String(Math.round(wPct)) + '%');
      usedFills[slot.fill] = wPct;
    }
    var allFills = doc.querySelectorAll('[data-fill]');
    for (var f = 0; f < allFills.length; f += 1) {
      var key = allFills[f].getAttribute('data-fill');
      var val = usedFills[key];
      ui.style(allFills[f], 'width', (val != null ? val : 0) + '%');
    }
  }

  function present(data) {
    if (!data || !data.updatedAt || !data.sources) return;
    if (state.renderedAt && timestamp(data.updatedAt) < timestamp(state.renderedAt)) return;

    state.latest = data;
    if (data.updatedAt !== state.renderedAt) {
      state.renderedAt = data.updatedAt;
      updateWeather(data.weather);
      updateMainCard(data.sources.minimax);
    }
    updateFreshness();
  }

  function requestData(url, canFallback) {
    var separator;
    if (!url || url.indexOf('__LIVE_') === 0) return;
    separator = url.indexOf('?') < 0 ? '?' : '&';
    attachScript(
      url + separator + '_=' + Date.now(),
      function () { present(win.DASH_DATA); },
      function () {
        if (canFallback && url !== settings.fallbackData) {
          requestData(settings.fallbackData, false);
        }
      }
    );
  }

  function refresh() {
    requestDeviceStatus();
    attachScript(
      settings.endpointPointer + '?_=' + Date.now(),
      function () {
        var supplied = win.DASH_LIVE_ENDPOINT || '';
        if (supplied && supplied.indexOf('__LIVE_') !== 0) state.endpoint = supplied;
        requestData(state.endpoint, true);
      },
      function () {
        state.endpoint = settings.fallbackData;
        requestData(state.endpoint, false);
      }
    );
  }

  function scheduleRefresh() {
    var now = new Date();
    var milliseconds = now.getTime();
    var delay;

    if (isQuiet(now)) {
      delay = millisecondsUntilMorning(now);
    } else {
      delay = (
        settings.pollOffset -
        (milliseconds % settings.pollEvery) +
        settings.pollEvery
      ) % settings.pollEvery;
      if (delay < 250) delay += settings.pollEvery;
    }

    setTimeout(function () {
      if (!isQuiet()) refresh();
      scheduleRefresh();
    }, delay);
  }

  function scheduleMinuteClock() {
    var now = new Date();
    var delay = isQuiet(now)
      ? millisecondsUntilMorning(now)
      : 60000 - (now.getTime() % 60000) + 100;
    setTimeout(function () {
      updateClock();
      scheduleMinuteClock();
    }, delay);
  }

  present(win.DASH_DATA);
  updateClock();
  updateBattery();
  if (!isQuiet()) refresh();
  scheduleRefresh();
  scheduleMinuteClock();
}(window, document));

  // 每 30 分钟后台拉新 data.js
  setInterval(function () {
    var s = doc.createElement('script');
    s.async = true;
    s.src = (state.endpoint || 'data.js') + '?t=' + Date.now();
    s.onload = function () {
      if (s.parentNode) s.parentNode.removeChild(s);
      if (win.DASH_DATA && win.DASH_DATA.updatedAt) {
        present(win.DASH_DATA);
        updateClock();
      }
    };
    s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); };
    doc.getElementsByTagName('head')[0].appendChild(s);
  }, 30 * 60 * 1000);