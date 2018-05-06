__resources__["/clientManager.js"] = {
  meta: {
    mimetype: "application/javascript"
  },
  data: function(exports, require, module, __filename, __dirname) {
    var heroSelectView = require('heroSelectView');  // role manager

    var pomelo = window.pomelo;
    var app = require('app');
    var EntityType = require('consts').EntityType;
    var Message = require('consts').MESSAGE;
    var loginMsgHandler = require('loginMsgHandler');
    var gameMsgHandler = require('gameMsgHandler');
    var switchManager = require('switchManager');
    var clientManager = require('clientManager');
    var dataApi = require('dataApi');
    var ResourceLoader = require('resourceLoader');
    var utils = require('utils');
    var config = require('config');

    var alert = window.alert;
    var self = this;

    var loading = false;
    var httpHost = location.href.replace(location.hash, '');

    pomelo.on('websocket-error', function(){
      loading = false;
    });

    function init() {
      //bind events
      $('#loginBtn').on('click', login);
      $('#registerBtn').on('click', register);
      $('#heroSelectBtn').on('click', createPlayer);
      //oauth button
      $('#authBtn li a').on('click', function () {
        var $a = $(this);
        var url = $a.attr('href');
        if (url && url !== '#') {
          window.open(window.location.origin + url, "auth", "toolbar=0,status=0,resizable=1,width=620,height=450,left=200,top=200");
        }
        return false;
      });

      // go to register
      $('#id_toRegisterBnt').on('click', function() {
        $('#id_loginFrame').addClass('f-dn');
        $('#id_registerFrame').removeClass('f-dn');
        return false;
      });

      // back button
      $('#id_registerFrame .bg3').on('click', function() {
        $('#id_loginFrame').removeClass('f-dn');
        $('#id_registerFrame').addClass('f-dn');
        return false;
      });
    }

    /**
     * login
     */
    function login() {
      if (loading) {
        return;
      }
      loading = true;
      var username = $('#loginUser').val().trim();
      var pwd = $('#loginPwd').val().trim();
      $('#loginPwd').val('');
      if (!username) {
        alert("Username is required!");
        loading = false;
        return;
      }

      if (!pwd) {
        alert("Password is required!");
        loading = false;
        return;
      }

        //"http://127.0.0.1:3001/login"
        //客户端输入账号密码，发送到register服务器
      $.post(httpHost + 'login', {username: username, password: pwd}, function(data) {
        if (data.code === 501) {
          alert('Username or password is invalid!');
          loading = false;
          return;
        }
        if (data.code !== 200) {
          alert('Username is not exists!');
          loading = false;
          return;
        }

        //发送token到gate服务器
        authEntry(data.uid, data.token, function() {
          loading = false;
        });
        localStorage.setItem('username', username);
      });
    }

    function queryEntry(uid, callback) {

      //客户端连接到pomelo的gate服务器上
      pomelo.init({host: config.GATE_HOST, port: config.GATE_PORT, log: true}, function() {

        //根据获得的host和ip发送token到指定的connector服务器
        pomelo.request('gate.gateHandler.queryEntry', { uid: uid}, function(data) {
          pomelo.disconnect();

          if(data.code === 2001) {
            alert('Servers error!');
            return;
          }

          callback(data.host, data.port);
        });
      });
    }

    /**
     * enter game server
     * route: connector.entryHandler.entry
     * response：
     * {
     *   code: [Number],
     *   player: [Object]
     * }
     */
    function entry(host, port, token, callback) {
      // init socketClient
      // TODO for development
      if(host === '127.0.0.1') {
        host = config.GATE_HOST;
      }
      pomelo.init({host: host, port: port, log: true}, function() {
        pomelo.request('connector.entryHandler.entry', {token: token}, function(data) {
          var player = data.player;

          if (callback) {
            callback(data.code);
          }

          if (data.code == 1001) {
            alert('Login fail!');
            return;
          } else if (data.code == 1003) {
            alert('Username not exists!');
            return;
          }

          if (data.code != 200) {
            alert('Login Fail!');
            return;
          }

          // init handler
            // 客户端收到玩家信息后，进行消息监听loginMsgHandler监听登陆和玩家在线情况
          loginMsgHandler.init();

          //gameMsgHandler游戏逻辑信息监听，如移动行为等
          gameMsgHandler.init();

          if (!player || player.id <= 0) {
            switchManager.selectView("heroSelectPanel");
          } else {
            afterLogin(data);
          }
        });
      });
    }

    function authEntry(uid, token, callback) {

      //gate服务器
      queryEntry(uid, function(host, port) {
        entry(host, port, token, callback);
      });
    }

    pomelo.authEntry = authEntry;

    //register
    function register() {
      if (loading) {
        return;
      }
      loading = true;
      var name = $('#reg-name').val().trim();
      var pwd = $('#reg-pwd').val().trim();
      var cpwd = $('#reg-cpwd').val().trim();
      $('#reg-pwd').val('');
      $('#reg-cpwd').val('');
      if (name === '') {
        alert('Username is required!');
        loading = false;
        return;
      }
      if (pwd === '') {
        alert('Password is required!');
        loading = false;
        return;
      }
      if (pwd != cpwd) {
        alert('Entered passwords differ!');
        loading = false;
        return;
      }
      $.post(httpHost + 'register', {name: name, password: pwd}, function(data) {
        if (data.code === 501) {
          alert('Username already exists！');
          loading = false;
        } else if (data.code === 200) {
          authEntry(data.uid, data.token, function() {
            loading = false;
          });
        } else {
          alert('Register fail！');
          loading = false;
        }
      });
    }

    // createPlayer
    function createPlayer() {
      if (loading) {
        return;
      }
      var roleId = heroSelectView.getRoleId();
      var name = document.getElementById('gameUserName').value.trim();
      var pwd = "pwd";

      if (!name) {
        alert("Role name is required!");
        loading = false;
      } else if (name.length > 9) {
        alert("Role name's length is too long!");
        loading = false;
      } else {
        pomelo.request("connector.roleHandler.createPlayer", {name: name, roleId: roleId}, function(data) {
          loading = false;
          if (data.code == 500) {
            alert("The name already exists!");
            return;
          }

          if (data.player.id <= 0) {
            switchManager.selectView("loginPanel");
          } else {
            afterLogin(data);
          }
        });
      }
    }

    //登陆后，加载地图信息，加载地图怪物，人物信息
    function afterLogin(data) {
      var userData = data.user;
      var playerData = data.player;

      var areaId = playerData.areaId;
      var areas = {1: {map: {id: 'jiangnanyewai.png', width: 3200, height: 2400}, id: 1}}; //读取trim地图信息

      if (!!userData) {
        pomelo.uid = userData.id;
      }
      pomelo.playerId = playerData.id;
      pomelo.areaId = areaId;
      pomelo.player = playerData;
      loadResource({jsonLoad: true}, function() {
        //enterScene();
        gamePrelude();
      });
    }

    function gamePrelude() {
      switchManager.selectView("gamePrelude");
      var entered = false;
      $('#id_skipbnt').on('click', function() {
        if (!entered) {
          entered = true;
          enterScene();
        }
      });
      setTimeout(function(){
        if (!entered) {
          entered = true;
          enterScene();
        }
      }, 12000);
    }


    function loadResource(opt, callback) {
      switchManager.selectView("loadingPanel");
      var loader = new ResourceLoader(opt);
      var $percent = $('#id_loadPercent').html(0);
      var $bar = $('#id_loadRate').css('width', 0);
      loader.on('loading', function(data) {
        var n = parseInt(data.loaded * 100 / data.total, 10);
        $bar.css('width', n + '%'); //加载地图进度
        $percent.html(n);
      });
      loader.on('complete', function() {  //完成
        if (callback) {
          setTimeout(function(){
            callback();
          }, 500);
        }
      });

      loader.loadAreaResource();
    }

    //加载完地图数据进入场景
    function enterScene(){
      pomelo.request("area.playerHandler.enterScene", null, function(data){
        app.init(data);
      });
    }

    // checkout the moveAimation
    function move(args) {
      var path = [{x: args.startX, y: args.startY}, {x: args.endX, y: args.endY}];
      var map = app.getCurArea().map;
      var paths = map.findPath(args.startX, args.startY, args.endX, args.endY);
      if(!paths || !paths.path){
        return;
      }
      var curPlayer = app.getCurArea().getCurPlayer();

      var area = app.getCurArea();
      var sprite = curPlayer.getSprite();
      var totalDistance = utils.totalDistance(paths.path);
      var needTime = Math.floor(totalDistance / sprite.getSpeed() * 1000 + app.getDelayTime());
      var speed = totalDistance/needTime * 1000;
      sprite.movePath(paths.path, speed);
      pomelo.request('area.playerHandler.move', {path: paths.path}, function(result) {
        if(result.code === Message.ERR){
          console.warn('curPlayer move error!');
          sprite.translateTo(paths.path[0].x, paths.path[0].y);
        }
      });
      sprite.movePath(paths.path);
    }

    //检查鼠标点击实物的事件，属于哪种类型
    function launchAi(args) {
      var areaId = pomelo.areaId;
      var playerId = pomelo.playerId;
      var targetId = args.id;
      if (pomelo.player.entityId === targetId) {
        return;
      }
      var skillId = pomelo.player.curSkill;
      var area = app.getCurArea();
      var entity = area.getEntity(targetId);
      if (entity.type === EntityType.PLAYER || entity.type === EntityType.MOB) { //被攻击的对象类型判断
        if (entity.died) {
          return;
        }
        if (entity.type === EntityType.PLAYER) { //如果是玩家，弹出选项，组队或者交易等
          var curPlayer = app.getCurPlayer();
          pomelo.emit('onPlayerDialog', {targetId: targetId, targetPlayerId: entity.id,
            targetTeamId: entity.teamId, targetIsCaptain: entity.isCaptain,
            myTeamId: curPlayer.teamId, myIsCaptain: curPlayer.isCaptain});
        } else if (entity.type === EntityType.MOB) {
          pomelo.request('area.fightHandler.attack',{targetId: targetId}, function() {}); //怪物
        }
      } else if (entity.type === EntityType.NPC) {
        pomelo.notify('area.playerHandler.npcTalk',{areaId :areaId, playerId: playerId, targetId: targetId}); //通知服务器处理攻击事件，不要求回调; npc
      } else if (entity.type === EntityType.ITEM || entity.type === EntityType.EQUIPMENT) { //检查一下就捡东西相关
        var curPlayer = app.getCurPlayer();
        var bag = curPlayer.bag;
        if (bag.isFull()) {
          curPlayer.getSprite().hintOfBag();
          return;
        }
        pomelo.request('area.playerHandler.pickItem',
          {areaId :areaId, playerId: playerId, targetId: targetId}, function() {}); //捡东西
      }
    }

    /**
     * amend the path of addressing
     * @param {Object} path   the path of addressing
     * @return {Object} path the path modified
     */
    function pathAmend(path) {
      var pathLength = path.length;
      for (var i = 0; i < pathLength-2; i ++) {
        var curPoint = path[i];
        var nextPoint = path[i+1];
        var nextNextponit = path[i+2];
        if (curPoint.x === nextPoint.x) {
          if (nextNextponit.x > nextPoint.x) {
            nextPoint.x += 1;
          } else {
            nextPoint.x -= 1;
          }
          path[i+1] = nextPoint;
        }
        if (curPoint.y === nextPoint.y) {
          if (nextNextponit.y > nextPoint.y) {
            nextPoint.y += 1;
          }else {
            nextPoint.y -= 1;
          }
          path[i+1] = nextPoint;
        }
      }
      return path;
    }


    // export object and interfaces
    exports.init = init;
    exports.entry = entry;
    exports.enterScene = enterScene;
    exports.move = move;
    exports.loadResource = loadResource;
    exports.launchAi = launchAi;

  }
};


