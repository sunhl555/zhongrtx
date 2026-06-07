Page({
  data: {
    guestName: '',
    fromName: ''
  },

  onLoad(options) {
    // 从分享参数读取宾客名和邀请人名
    if (options.guest) {
      this.setData({ guestName: decodeURIComponent(options.guest) });
    }
    if (options.from) {
      this.setData({ fromName: decodeURIComponent(options.from) });
    }

    // 启用分享
    wx.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage']
    });
  },

  // 宾客姓名输入
  onGuestInput(e) {
    this.setData({ guestName: e.detail.value });
  },

  // 邀请人姓名输入
  onFromInput(e) {
    this.setData({ fromName: e.detail.value });
  },

  // 微信分享 - 携带当前姓名参数
  onShareAppMessage() {
    var path = 'pages/invitation/index';
    var params = [];
    if (this.data.guestName) {
      params.push('guest=' + encodeURIComponent(this.data.guestName));
    }
    if (this.data.fromName) {
      params.push('from=' + encodeURIComponent(this.data.fromName));
    }
    if (params.length) {
      path += '?' + params.join('&');
    }
    return {
      title: '婚礼请柬 · 刘锦懿 & 杨秀群',
      path: path,
      imageUrl: 'https://sunhl555.github.io/zhongrtx/cover-deco.jpg'
    };
  }
});
