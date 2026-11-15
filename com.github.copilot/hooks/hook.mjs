import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/graceful-fs/polyfills.js"(exports, module) {
    var constants = __require("constants");
    var origCwd = process.cwd;
    var cwd = null;
    var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
    process.cwd = function() {
      if (!cwd)
        cwd = origCwd.call(process);
      return cwd;
    };
    try {
      process.cwd();
    } catch (er) {
    }
    if (typeof process.chdir === "function") {
      chdir = process.chdir;
      process.chdir = function(d) {
        cwd = null;
        chdir.call(process, d);
      };
      if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
    }
    var chdir;
    module.exports = patch;
    function patch(fs) {
      if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
        patchLchmod(fs);
      }
      if (!fs.lutimes) {
        patchLutimes(fs);
      }
      fs.chown = chownFix(fs.chown);
      fs.fchown = chownFix(fs.fchown);
      fs.lchown = chownFix(fs.lchown);
      fs.chmod = chmodFix(fs.chmod);
      fs.fchmod = chmodFix(fs.fchmod);
      fs.lchmod = chmodFix(fs.lchmod);
      fs.chownSync = chownFixSync(fs.chownSync);
      fs.fchownSync = chownFixSync(fs.fchownSync);
      fs.lchownSync = chownFixSync(fs.lchownSync);
      fs.chmodSync = chmodFixSync(fs.chmodSync);
      fs.fchmodSync = chmodFixSync(fs.fchmodSync);
      fs.lchmodSync = chmodFixSync(fs.lchmodSync);
      fs.stat = statFix(fs.stat);
      fs.fstat = statFix(fs.fstat);
      fs.lstat = statFix(fs.lstat);
      fs.statSync = statFixSync(fs.statSync);
      fs.fstatSync = statFixSync(fs.fstatSync);
      fs.lstatSync = statFixSync(fs.lstatSync);
      if (fs.chmod && !fs.lchmod) {
        fs.lchmod = function(path, mode, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchmodSync = function() {
        };
      }
      if (fs.chown && !fs.lchown) {
        fs.lchown = function(path, uid, gid, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchownSync = function() {
        };
      }
      if (platform === "win32") {
        fs.rename = typeof fs.rename !== "function" ? fs.rename : (function(fs$rename) {
          function rename2(from, to, cb) {
            var start = Date.now();
            var backoff = 0;
            fs$rename(from, to, function CB(er) {
              if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
                setTimeout(function() {
                  fs.stat(to, function(stater, st) {
                    if (stater && stater.code === "ENOENT")
                      fs$rename(from, to, CB);
                    else
                      cb(er);
                  });
                }, backoff);
                if (backoff < 100)
                  backoff += 10;
                return;
              }
              if (cb) cb(er);
            });
          }
          if (Object.setPrototypeOf) Object.setPrototypeOf(rename2, fs$rename);
          return rename2;
        })(fs.rename);
      }
      fs.read = typeof fs.read !== "function" ? fs.read : (function(fs$read) {
        function read(fd, buffer, offset, length, position, callback_) {
          var callback;
          if (callback_ && typeof callback_ === "function") {
            var eagCounter = 0;
            callback = function(er, _, __) {
              if (er && er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                return fs$read.call(fs, fd, buffer, offset, length, position, callback);
              }
              callback_.apply(this, arguments);
            };
          }
          return fs$read.call(fs, fd, buffer, offset, length, position, callback);
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
        return read;
      })(fs.read);
      fs.readSync = typeof fs.readSync !== "function" ? fs.readSync : /* @__PURE__ */ (function(fs$readSync) {
        return function(fd, buffer, offset, length, position) {
          var eagCounter = 0;
          while (true) {
            try {
              return fs$readSync.call(fs, fd, buffer, offset, length, position);
            } catch (er) {
              if (er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                continue;
              }
              throw er;
            }
          }
        };
      })(fs.readSync);
      function patchLchmod(fs2) {
        fs2.lchmod = function(path, mode, callback) {
          fs2.open(
            path,
            constants.O_WRONLY | constants.O_SYMLINK,
            mode,
            function(err, fd) {
              if (err) {
                if (callback) callback(err);
                return;
              }
              fs2.fchmod(fd, mode, function(err2) {
                fs2.close(fd, function(err22) {
                  if (callback) callback(err2 || err22);
                });
              });
            }
          );
        };
        fs2.lchmodSync = function(path, mode) {
          var fd = fs2.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
          var threw = true;
          var ret;
          try {
            ret = fs2.fchmodSync(fd, mode);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs2.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs2.closeSync(fd);
            }
          }
          return ret;
        };
      }
      function patchLutimes(fs2) {
        if (constants.hasOwnProperty("O_SYMLINK") && fs2.futimes) {
          fs2.lutimes = function(path, at, mt, cb) {
            fs2.open(path, constants.O_SYMLINK, function(er, fd) {
              if (er) {
                if (cb) cb(er);
                return;
              }
              fs2.futimes(fd, at, mt, function(er2) {
                fs2.close(fd, function(er22) {
                  if (cb) cb(er2 || er22);
                });
              });
            });
          };
          fs2.lutimesSync = function(path, at, mt) {
            var fd = fs2.openSync(path, constants.O_SYMLINK);
            var ret;
            var threw = true;
            try {
              ret = fs2.futimesSync(fd, at, mt);
              threw = false;
            } finally {
              if (threw) {
                try {
                  fs2.closeSync(fd);
                } catch (er) {
                }
              } else {
                fs2.closeSync(fd);
              }
            }
            return ret;
          };
        } else if (fs2.futimes) {
          fs2.lutimes = function(_a, _b, _c, cb) {
            if (cb) process.nextTick(cb);
          };
          fs2.lutimesSync = function() {
          };
        }
      }
      function chmodFix(orig) {
        if (!orig) return orig;
        return function(target, mode, cb) {
          return orig.call(fs, target, mode, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chmodFixSync(orig) {
        if (!orig) return orig;
        return function(target, mode) {
          try {
            return orig.call(fs, target, mode);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function chownFix(orig) {
        if (!orig) return orig;
        return function(target, uid, gid, cb) {
          return orig.call(fs, target, uid, gid, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chownFixSync(orig) {
        if (!orig) return orig;
        return function(target, uid, gid) {
          try {
            return orig.call(fs, target, uid, gid);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function statFix(orig) {
        if (!orig) return orig;
        return function(target, options, cb) {
          if (typeof options === "function") {
            cb = options;
            options = null;
          }
          function callback(er, stats) {
            if (stats) {
              if (stats.uid < 0) stats.uid += 4294967296;
              if (stats.gid < 0) stats.gid += 4294967296;
            }
            if (cb) cb.apply(this, arguments);
          }
          return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
        };
      }
      function statFixSync(orig) {
        if (!orig) return orig;
        return function(target, options) {
          var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          return stats;
        };
      }
      function chownErOk(er) {
        if (!er)
          return true;
        if (er.code === "ENOSYS")
          return true;
        var nonroot = !process.getuid || process.getuid() !== 0;
        if (nonroot) {
          if (er.code === "EINVAL" || er.code === "EPERM")
            return true;
        }
        return false;
      }
    }
  }
});

// node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS({
  "node_modules/graceful-fs/legacy-streams.js"(exports, module) {
    var Stream = __require("stream").Stream;
    module.exports = legacy;
    function legacy(fs) {
      return {
        ReadStream,
        WriteStream
      };
      function ReadStream(path, options) {
        if (!(this instanceof ReadStream)) return new ReadStream(path, options);
        Stream.call(this);
        var self = this;
        this.path = path;
        this.fd = null;
        this.readable = true;
        this.paused = false;
        this.flags = "r";
        this.mode = 438;
        this.bufferSize = 64 * 1024;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.encoding) this.setEncoding(this.encoding);
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if ("number" !== typeof this.end) {
            throw TypeError("end must be a Number");
          }
          if (this.start > this.end) {
            throw new Error("start must be <= end");
          }
          this.pos = this.start;
        }
        if (this.fd !== null) {
          process.nextTick(function() {
            self._read();
          });
          return;
        }
        fs.open(this.path, this.flags, this.mode, function(err, fd) {
          if (err) {
            self.emit("error", err);
            self.readable = false;
            return;
          }
          self.fd = fd;
          self.emit("open", fd);
          self._read();
        });
      }
      function WriteStream(path, options) {
        if (!(this instanceof WriteStream)) return new WriteStream(path, options);
        Stream.call(this);
        this.path = path;
        this.fd = null;
        this.writable = true;
        this.flags = "w";
        this.encoding = "binary";
        this.mode = 438;
        this.bytesWritten = 0;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.start < 0) {
            throw new Error("start must be >= zero");
          }
          this.pos = this.start;
        }
        this.busy = false;
        this._queue = [];
        if (this.fd === null) {
          this._open = fs.open;
          this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
          this.flush();
        }
      }
    }
  }
});

// node_modules/graceful-fs/clone.js
var require_clone = __commonJS({
  "node_modules/graceful-fs/clone.js"(exports, module) {
    "use strict";
    module.exports = clone;
    var getPrototypeOf = Object.getPrototypeOf || function(obj) {
      return obj.__proto__;
    };
    function clone(obj) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (obj instanceof Object)
        var copy = { __proto__: getPrototypeOf(obj) };
      else
        var copy = /* @__PURE__ */ Object.create(null);
      Object.getOwnPropertyNames(obj).forEach(function(key) {
        Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
      });
      return copy;
    }
  }
});

// node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS({
  "node_modules/graceful-fs/graceful-fs.js"(exports, module) {
    var fs = __require("fs");
    var polyfills = require_polyfills();
    var legacy = require_legacy_streams();
    var clone = require_clone();
    var util = __require("util");
    var gracefulQueue;
    var previousSymbol;
    if (typeof Symbol === "function" && typeof Symbol.for === "function") {
      gracefulQueue = Symbol.for("graceful-fs.queue");
      previousSymbol = Symbol.for("graceful-fs.previous");
    } else {
      gracefulQueue = "___graceful-fs.queue";
      previousSymbol = "___graceful-fs.previous";
    }
    function noop() {
    }
    function publishQueue(context, queue2) {
      Object.defineProperty(context, gracefulQueue, {
        get: function() {
          return queue2;
        }
      });
    }
    var debug = noop;
    if (util.debuglog)
      debug = util.debuglog("gfs4");
    else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
      debug = function() {
        var m = util.format.apply(util, arguments);
        m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
        console.error(m);
      };
    if (!fs[gracefulQueue]) {
      queue = global[gracefulQueue] || [];
      publishQueue(fs, queue);
      fs.close = (function(fs$close) {
        function close(fd, cb) {
          return fs$close.call(fs, fd, function(err) {
            if (!err) {
              resetQueue();
            }
            if (typeof cb === "function")
              cb.apply(this, arguments);
          });
        }
        Object.defineProperty(close, previousSymbol, {
          value: fs$close
        });
        return close;
      })(fs.close);
      fs.closeSync = (function(fs$closeSync) {
        function closeSync(fd) {
          fs$closeSync.apply(fs, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync, previousSymbol, {
          value: fs$closeSync
        });
        return closeSync;
      })(fs.closeSync);
      if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
        process.on("exit", function() {
          debug(fs[gracefulQueue]);
          __require("assert").equal(fs[gracefulQueue].length, 0);
        });
      }
    }
    var queue;
    if (!global[gracefulQueue]) {
      publishQueue(global, fs[gracefulQueue]);
    }
    module.exports = patch(clone(fs));
    if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
      module.exports = patch(fs);
      fs.__patched = true;
    }
    function patch(fs2) {
      polyfills(fs2);
      fs2.gracefulify = patch;
      fs2.createReadStream = createReadStream;
      fs2.createWriteStream = createWriteStream;
      var fs$readFile = fs2.readFile;
      fs2.readFile = readFile6;
      function readFile6(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$readFile(path, options, cb);
        function go$readFile(path2, options2, cb2, startTime) {
          return fs$readFile(path2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$readFile, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$writeFile = fs2.writeFile;
      fs2.writeFile = writeFile2;
      function writeFile2(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$writeFile(path, data, options, cb);
        function go$writeFile(path2, data2, options2, cb2, startTime) {
          return fs$writeFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$writeFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$appendFile = fs2.appendFile;
      if (fs$appendFile)
        fs2.appendFile = appendFile2;
      function appendFile2(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$appendFile(path, data, options, cb);
        function go$appendFile(path2, data2, options2, cb2, startTime) {
          return fs$appendFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$appendFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$copyFile = fs2.copyFile;
      if (fs$copyFile)
        fs2.copyFile = copyFile;
      function copyFile(src, dest, flags, cb) {
        if (typeof flags === "function") {
          cb = flags;
          flags = 0;
        }
        return go$copyFile(src, dest, flags, cb);
        function go$copyFile(src2, dest2, flags2, cb2, startTime) {
          return fs$copyFile(src2, dest2, flags2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$readdir = fs2.readdir;
      fs2.readdir = readdir3;
      var noReaddirOptionVersions = /^v[0-5]\./;
      function readdir3(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        } : function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, options2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        };
        return go$readdir(path, options, cb);
        function fs$readdirCallback(path2, options2, cb2, startTime) {
          return function(err, files) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([
                go$readdir,
                [path2, options2, cb2],
                err,
                startTime || Date.now(),
                Date.now()
              ]);
            else {
              if (files && files.sort)
                files.sort();
              if (typeof cb2 === "function")
                cb2.call(this, err, files);
            }
          };
        }
      }
      if (process.version.substr(0, 4) === "v0.8") {
        var legStreams = legacy(fs2);
        ReadStream = legStreams.ReadStream;
        WriteStream = legStreams.WriteStream;
      }
      var fs$ReadStream = fs2.ReadStream;
      if (fs$ReadStream) {
        ReadStream.prototype = Object.create(fs$ReadStream.prototype);
        ReadStream.prototype.open = ReadStream$open;
      }
      var fs$WriteStream = fs2.WriteStream;
      if (fs$WriteStream) {
        WriteStream.prototype = Object.create(fs$WriteStream.prototype);
        WriteStream.prototype.open = WriteStream$open;
      }
      Object.defineProperty(fs2, "ReadStream", {
        get: function() {
          return ReadStream;
        },
        set: function(val) {
          ReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(fs2, "WriteStream", {
        get: function() {
          return WriteStream;
        },
        set: function(val) {
          WriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileReadStream = ReadStream;
      Object.defineProperty(fs2, "FileReadStream", {
        get: function() {
          return FileReadStream;
        },
        set: function(val) {
          FileReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileWriteStream = WriteStream;
      Object.defineProperty(fs2, "FileWriteStream", {
        get: function() {
          return FileWriteStream;
        },
        set: function(val) {
          FileWriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      function ReadStream(path, options) {
        if (this instanceof ReadStream)
          return fs$ReadStream.apply(this, arguments), this;
        else
          return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
      }
      function ReadStream$open() {
        var that = this;
        open2(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            if (that.autoClose)
              that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
            that.read();
          }
        });
      }
      function WriteStream(path, options) {
        if (this instanceof WriteStream)
          return fs$WriteStream.apply(this, arguments), this;
        else
          return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
      }
      function WriteStream$open() {
        var that = this;
        open2(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
          }
        });
      }
      function createReadStream(path, options) {
        return new fs2.ReadStream(path, options);
      }
      function createWriteStream(path, options) {
        return new fs2.WriteStream(path, options);
      }
      var fs$open = fs2.open;
      fs2.open = open2;
      function open2(path, flags, mode, cb) {
        if (typeof mode === "function")
          cb = mode, mode = null;
        return go$open(path, flags, mode, cb);
        function go$open(path2, flags2, mode2, cb2, startTime) {
          return fs$open(path2, flags2, mode2, function(err, fd) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$open, [path2, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      return fs2;
    }
    function enqueue(elem) {
      debug("ENQUEUE", elem[0].name, elem[1]);
      fs[gracefulQueue].push(elem);
      retry();
    }
    var retryTimer;
    function resetQueue() {
      var now = Date.now();
      for (var i = 0; i < fs[gracefulQueue].length; ++i) {
        if (fs[gracefulQueue][i].length > 2) {
          fs[gracefulQueue][i][3] = now;
          fs[gracefulQueue][i][4] = now;
        }
      }
      retry();
    }
    function retry() {
      clearTimeout(retryTimer);
      retryTimer = void 0;
      if (fs[gracefulQueue].length === 0)
        return;
      var elem = fs[gracefulQueue].shift();
      var fn = elem[0];
      var args = elem[1];
      var err = elem[2];
      var startTime = elem[3];
      var lastTime = elem[4];
      if (startTime === void 0) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args);
      } else if (Date.now() - startTime >= 6e4) {
        debug("TIMEOUT", fn.name, args);
        var cb = args.pop();
        if (typeof cb === "function")
          cb.call(null, err);
      } else {
        var sinceAttempt = Date.now() - lastTime;
        var sinceStart = Math.max(lastTime - startTime, 1);
        var desiredDelay = Math.min(sinceStart * 1.2, 100);
        if (sinceAttempt >= desiredDelay) {
          debug("RETRY", fn.name, args);
          fn.apply(null, args.concat([startTime]));
        } else {
          fs[gracefulQueue].push(elem);
        }
      }
      if (retryTimer === void 0) {
        retryTimer = setTimeout(retry, 0);
      }
    }
  }
});

// node_modules/retry/lib/retry_operation.js
var require_retry_operation = __commonJS({
  "node_modules/retry/lib/retry_operation.js"(exports, module) {
    function RetryOperation(timeouts, options) {
      if (typeof options === "boolean") {
        options = { forever: options };
      }
      this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
      this._timeouts = timeouts;
      this._options = options || {};
      this._maxRetryTime = options && options.maxRetryTime || Infinity;
      this._fn = null;
      this._errors = [];
      this._attempts = 1;
      this._operationTimeout = null;
      this._operationTimeoutCb = null;
      this._timeout = null;
      this._operationStart = null;
      if (this._options.forever) {
        this._cachedTimeouts = this._timeouts.slice(0);
      }
    }
    module.exports = RetryOperation;
    RetryOperation.prototype.reset = function() {
      this._attempts = 1;
      this._timeouts = this._originalTimeouts;
    };
    RetryOperation.prototype.stop = function() {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      this._timeouts = [];
      this._cachedTimeouts = null;
    };
    RetryOperation.prototype.retry = function(err) {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      if (!err) {
        return false;
      }
      var currentTime = (/* @__PURE__ */ new Date()).getTime();
      if (err && currentTime - this._operationStart >= this._maxRetryTime) {
        this._errors.unshift(new Error("RetryOperation timeout occurred"));
        return false;
      }
      this._errors.push(err);
      var timeout = this._timeouts.shift();
      if (timeout === void 0) {
        if (this._cachedTimeouts) {
          this._errors.splice(this._errors.length - 1, this._errors.length);
          this._timeouts = this._cachedTimeouts.slice(0);
          timeout = this._timeouts.shift();
        } else {
          return false;
        }
      }
      var self = this;
      var timer = setTimeout(function() {
        self._attempts++;
        if (self._operationTimeoutCb) {
          self._timeout = setTimeout(function() {
            self._operationTimeoutCb(self._attempts);
          }, self._operationTimeout);
          if (self._options.unref) {
            self._timeout.unref();
          }
        }
        self._fn(self._attempts);
      }, timeout);
      if (this._options.unref) {
        timer.unref();
      }
      return true;
    };
    RetryOperation.prototype.attempt = function(fn, timeoutOps) {
      this._fn = fn;
      if (timeoutOps) {
        if (timeoutOps.timeout) {
          this._operationTimeout = timeoutOps.timeout;
        }
        if (timeoutOps.cb) {
          this._operationTimeoutCb = timeoutOps.cb;
        }
      }
      var self = this;
      if (this._operationTimeoutCb) {
        this._timeout = setTimeout(function() {
          self._operationTimeoutCb();
        }, self._operationTimeout);
      }
      this._operationStart = (/* @__PURE__ */ new Date()).getTime();
      this._fn(this._attempts);
    };
    RetryOperation.prototype.try = function(fn) {
      console.log("Using RetryOperation.try() is deprecated");
      this.attempt(fn);
    };
    RetryOperation.prototype.start = function(fn) {
      console.log("Using RetryOperation.start() is deprecated");
      this.attempt(fn);
    };
    RetryOperation.prototype.start = RetryOperation.prototype.try;
    RetryOperation.prototype.errors = function() {
      return this._errors;
    };
    RetryOperation.prototype.attempts = function() {
      return this._attempts;
    };
    RetryOperation.prototype.mainError = function() {
      if (this._errors.length === 0) {
        return null;
      }
      var counts = {};
      var mainError = null;
      var mainErrorCount = 0;
      for (var i = 0; i < this._errors.length; i++) {
        var error = this._errors[i];
        var message = error.message;
        var count = (counts[message] || 0) + 1;
        counts[message] = count;
        if (count >= mainErrorCount) {
          mainError = error;
          mainErrorCount = count;
        }
      }
      return mainError;
    };
  }
});

// node_modules/retry/lib/retry.js
var require_retry = __commonJS({
  "node_modules/retry/lib/retry.js"(exports) {
    var RetryOperation = require_retry_operation();
    exports.operation = function(options) {
      var timeouts = exports.timeouts(options);
      return new RetryOperation(timeouts, {
        forever: options && options.forever,
        unref: options && options.unref,
        maxRetryTime: options && options.maxRetryTime
      });
    };
    exports.timeouts = function(options) {
      if (options instanceof Array) {
        return [].concat(options);
      }
      var opts = {
        retries: 10,
        factor: 2,
        minTimeout: 1 * 1e3,
        maxTimeout: Infinity,
        randomize: false
      };
      for (var key in options) {
        opts[key] = options[key];
      }
      if (opts.minTimeout > opts.maxTimeout) {
        throw new Error("minTimeout is greater than maxTimeout");
      }
      var timeouts = [];
      for (var i = 0; i < opts.retries; i++) {
        timeouts.push(this.createTimeout(i, opts));
      }
      if (options && options.forever && !timeouts.length) {
        timeouts.push(this.createTimeout(i, opts));
      }
      timeouts.sort(function(a, b) {
        return a - b;
      });
      return timeouts;
    };
    exports.createTimeout = function(attempt, opts) {
      var random = opts.randomize ? Math.random() + 1 : 1;
      var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
      timeout = Math.min(timeout, opts.maxTimeout);
      return timeout;
    };
    exports.wrap = function(obj, options, methods) {
      if (options instanceof Array) {
        methods = options;
        options = null;
      }
      if (!methods) {
        methods = [];
        for (var key in obj) {
          if (typeof obj[key] === "function") {
            methods.push(key);
          }
        }
      }
      for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        var original = obj[method];
        obj[method] = function retryWrapper(original2) {
          var op = exports.operation(options);
          var args = Array.prototype.slice.call(arguments, 1);
          var callback = args.pop();
          args.push(function(err) {
            if (op.retry(err)) {
              return;
            }
            if (err) {
              arguments[0] = op.mainError();
            }
            callback.apply(this, arguments);
          });
          op.attempt(function() {
            original2.apply(obj, args);
          });
        }.bind(obj, original);
        obj[method].options = options;
      }
    };
  }
});

// node_modules/retry/index.js
var require_retry2 = __commonJS({
  "node_modules/retry/index.js"(exports, module) {
    module.exports = require_retry();
  }
});

// node_modules/signal-exit/signals.js
var require_signals = __commonJS({
  "node_modules/signal-exit/signals.js"(exports, module) {
    module.exports = [
      "SIGABRT",
      "SIGALRM",
      "SIGHUP",
      "SIGINT",
      "SIGTERM"
    ];
    if (process.platform !== "win32") {
      module.exports.push(
        "SIGVTALRM",
        "SIGXCPU",
        "SIGXFSZ",
        "SIGUSR2",
        "SIGTRAP",
        "SIGSYS",
        "SIGQUIT",
        "SIGIOT"
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === "linux") {
      module.exports.push(
        "SIGIO",
        "SIGPOLL",
        "SIGPWR",
        "SIGSTKFLT",
        "SIGUNUSED"
      );
    }
  }
});

// node_modules/signal-exit/index.js
var require_signal_exit = __commonJS({
  "node_modules/signal-exit/index.js"(exports, module) {
    var process2 = global.process;
    var processOk = function(process3) {
      return process3 && typeof process3 === "object" && typeof process3.removeListener === "function" && typeof process3.emit === "function" && typeof process3.reallyExit === "function" && typeof process3.listeners === "function" && typeof process3.kill === "function" && typeof process3.pid === "number" && typeof process3.on === "function";
    };
    if (!processOk(process2)) {
      module.exports = function() {
        return function() {
        };
      };
    } else {
      assert = __require("assert");
      signals = require_signals();
      isWin = /^win/i.test(process2.platform);
      EE = __require("events");
      if (typeof EE !== "function") {
        EE = EE.EventEmitter;
      }
      if (process2.__signal_exit_emitter__) {
        emitter = process2.__signal_exit_emitter__;
      } else {
        emitter = process2.__signal_exit_emitter__ = new EE();
        emitter.count = 0;
        emitter.emitted = {};
      }
      if (!emitter.infinite) {
        emitter.setMaxListeners(Infinity);
        emitter.infinite = true;
      }
      module.exports = function(cb, opts) {
        if (!processOk(global.process)) {
          return function() {
          };
        }
        assert.equal(typeof cb, "function", "a callback must be provided for exit handler");
        if (loaded === false) {
          load();
        }
        var ev = "exit";
        if (opts && opts.alwaysLast) {
          ev = "afterexit";
        }
        var remove = function() {
          emitter.removeListener(ev, cb);
          if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) {
            unload();
          }
        };
        emitter.on(ev, cb);
        return remove;
      };
      unload = function unload2() {
        if (!loaded || !processOk(global.process)) {
          return;
        }
        loaded = false;
        signals.forEach(function(sig) {
          try {
            process2.removeListener(sig, sigListeners[sig]);
          } catch (er) {
          }
        });
        process2.emit = originalProcessEmit;
        process2.reallyExit = originalProcessReallyExit;
        emitter.count -= 1;
      };
      module.exports.unload = unload;
      emit = function emit2(event, code, signal) {
        if (emitter.emitted[event]) {
          return;
        }
        emitter.emitted[event] = true;
        emitter.emit(event, code, signal);
      };
      sigListeners = {};
      signals.forEach(function(sig) {
        sigListeners[sig] = function listener() {
          if (!processOk(global.process)) {
            return;
          }
          var listeners = process2.listeners(sig);
          if (listeners.length === emitter.count) {
            unload();
            emit("exit", null, sig);
            emit("afterexit", null, sig);
            if (isWin && sig === "SIGHUP") {
              sig = "SIGINT";
            }
            process2.kill(process2.pid, sig);
          }
        };
      });
      module.exports.signals = function() {
        return signals;
      };
      loaded = false;
      load = function load2() {
        if (loaded || !processOk(global.process)) {
          return;
        }
        loaded = true;
        emitter.count += 1;
        signals = signals.filter(function(sig) {
          try {
            process2.on(sig, sigListeners[sig]);
            return true;
          } catch (er) {
            return false;
          }
        });
        process2.emit = processEmit;
        process2.reallyExit = processReallyExit;
      };
      module.exports.load = load;
      originalProcessReallyExit = process2.reallyExit;
      processReallyExit = function processReallyExit2(code) {
        if (!processOk(global.process)) {
          return;
        }
        process2.exitCode = code || /* istanbul ignore next */
        0;
        emit("exit", process2.exitCode, null);
        emit("afterexit", process2.exitCode, null);
        originalProcessReallyExit.call(process2, process2.exitCode);
      };
      originalProcessEmit = process2.emit;
      processEmit = function processEmit2(ev, arg) {
        if (ev === "exit" && processOk(global.process)) {
          if (arg !== void 0) {
            process2.exitCode = arg;
          }
          var ret = originalProcessEmit.apply(this, arguments);
          emit("exit", process2.exitCode, null);
          emit("afterexit", process2.exitCode, null);
          return ret;
        } else {
          return originalProcessEmit.apply(this, arguments);
        }
      };
    }
    var assert;
    var signals;
    var isWin;
    var EE;
    var emitter;
    var unload;
    var emit;
    var sigListeners;
    var loaded;
    var load;
    var originalProcessReallyExit;
    var processReallyExit;
    var originalProcessEmit;
    var processEmit;
  }
});

// node_modules/proper-lockfile/lib/mtime-precision.js
var require_mtime_precision = __commonJS({
  "node_modules/proper-lockfile/lib/mtime-precision.js"(exports, module) {
    "use strict";
    var cacheSymbol = Symbol();
    function probe(file, fs, callback) {
      const cachedPrecision = fs[cacheSymbol];
      if (cachedPrecision) {
        return fs.stat(file, (err, stat4) => {
          if (err) {
            return callback(err);
          }
          callback(null, stat4.mtime, cachedPrecision);
        });
      }
      const mtime = new Date(Math.ceil(Date.now() / 1e3) * 1e3 + 5);
      fs.utimes(file, mtime, mtime, (err) => {
        if (err) {
          return callback(err);
        }
        fs.stat(file, (err2, stat4) => {
          if (err2) {
            return callback(err2);
          }
          const precision = stat4.mtime.getTime() % 1e3 === 0 ? "s" : "ms";
          Object.defineProperty(fs, cacheSymbol, { value: precision });
          callback(null, stat4.mtime, precision);
        });
      });
    }
    function getMtime(precision) {
      let now = Date.now();
      if (precision === "s") {
        now = Math.ceil(now / 1e3) * 1e3;
      }
      return new Date(now);
    }
    module.exports.probe = probe;
    module.exports.getMtime = getMtime;
  }
});

// node_modules/proper-lockfile/lib/lockfile.js
var require_lockfile = __commonJS({
  "node_modules/proper-lockfile/lib/lockfile.js"(exports, module) {
    "use strict";
    var path = __require("path");
    var fs = require_graceful_fs();
    var retry = require_retry2();
    var onExit = require_signal_exit();
    var mtimePrecision = require_mtime_precision();
    var locks = {};
    function getLockFile(file, options) {
      return options.lockfilePath || `${file}.lock`;
    }
    function resolveCanonicalPath(file, options, callback) {
      if (!options.realpath) {
        return callback(null, path.resolve(file));
      }
      options.fs.realpath(file, callback);
    }
    function acquireLock(file, options, callback) {
      const lockfilePath = getLockFile(file, options);
      options.fs.mkdir(lockfilePath, (err) => {
        if (!err) {
          return mtimePrecision.probe(lockfilePath, options.fs, (err2, mtime, mtimePrecision2) => {
            if (err2) {
              options.fs.rmdir(lockfilePath, () => {
              });
              return callback(err2);
            }
            callback(null, mtime, mtimePrecision2);
          });
        }
        if (err.code !== "EEXIST") {
          return callback(err);
        }
        if (options.stale <= 0) {
          return callback(Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED", file }));
        }
        options.fs.stat(lockfilePath, (err2, stat4) => {
          if (err2) {
            if (err2.code === "ENOENT") {
              return acquireLock(file, { ...options, stale: 0 }, callback);
            }
            return callback(err2);
          }
          if (!isLockStale(stat4, options)) {
            return callback(Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED", file }));
          }
          removeLock(file, options, (err3) => {
            if (err3) {
              return callback(err3);
            }
            acquireLock(file, { ...options, stale: 0 }, callback);
          });
        });
      });
    }
    function isLockStale(stat4, options) {
      return stat4.mtime.getTime() < Date.now() - options.stale;
    }
    function removeLock(file, options, callback) {
      options.fs.rmdir(getLockFile(file, options), (err) => {
        if (err && err.code !== "ENOENT") {
          return callback(err);
        }
        callback();
      });
    }
    function updateLock(file, options) {
      const lock2 = locks[file];
      if (lock2.updateTimeout) {
        return;
      }
      lock2.updateDelay = lock2.updateDelay || options.update;
      lock2.updateTimeout = setTimeout(() => {
        lock2.updateTimeout = null;
        options.fs.stat(lock2.lockfilePath, (err, stat4) => {
          const isOverThreshold = lock2.lastUpdate + options.stale < Date.now();
          if (err) {
            if (err.code === "ENOENT" || isOverThreshold) {
              return setLockAsCompromised(file, lock2, Object.assign(err, { code: "ECOMPROMISED" }));
            }
            lock2.updateDelay = 1e3;
            return updateLock(file, options);
          }
          const isMtimeOurs = lock2.mtime.getTime() === stat4.mtime.getTime();
          if (!isMtimeOurs) {
            return setLockAsCompromised(
              file,
              lock2,
              Object.assign(
                new Error("Unable to update lock within the stale threshold"),
                { code: "ECOMPROMISED" }
              )
            );
          }
          const mtime = mtimePrecision.getMtime(lock2.mtimePrecision);
          options.fs.utimes(lock2.lockfilePath, mtime, mtime, (err2) => {
            const isOverThreshold2 = lock2.lastUpdate + options.stale < Date.now();
            if (lock2.released) {
              return;
            }
            if (err2) {
              if (err2.code === "ENOENT" || isOverThreshold2) {
                return setLockAsCompromised(file, lock2, Object.assign(err2, { code: "ECOMPROMISED" }));
              }
              lock2.updateDelay = 1e3;
              return updateLock(file, options);
            }
            lock2.mtime = mtime;
            lock2.lastUpdate = Date.now();
            lock2.updateDelay = null;
            updateLock(file, options);
          });
        });
      }, lock2.updateDelay);
      if (lock2.updateTimeout.unref) {
        lock2.updateTimeout.unref();
      }
    }
    function setLockAsCompromised(file, lock2, err) {
      lock2.released = true;
      if (lock2.updateTimeout) {
        clearTimeout(lock2.updateTimeout);
      }
      if (locks[file] === lock2) {
        delete locks[file];
      }
      lock2.options.onCompromised(err);
    }
    function lock(file, options, callback) {
      options = {
        stale: 1e4,
        update: null,
        realpath: true,
        retries: 0,
        fs,
        onCompromised: (err) => {
          throw err;
        },
        ...options
      };
      options.retries = options.retries || 0;
      options.retries = typeof options.retries === "number" ? { retries: options.retries } : options.retries;
      options.stale = Math.max(options.stale || 0, 2e3);
      options.update = options.update == null ? options.stale / 2 : options.update || 0;
      options.update = Math.max(Math.min(options.update, options.stale / 2), 1e3);
      resolveCanonicalPath(file, options, (err, file2) => {
        if (err) {
          return callback(err);
        }
        const operation = retry.operation(options.retries);
        operation.attempt(() => {
          acquireLock(file2, options, (err2, mtime, mtimePrecision2) => {
            if (operation.retry(err2)) {
              return;
            }
            if (err2) {
              return callback(operation.mainError());
            }
            const lock2 = locks[file2] = {
              lockfilePath: getLockFile(file2, options),
              mtime,
              mtimePrecision: mtimePrecision2,
              options,
              lastUpdate: Date.now()
            };
            updateLock(file2, options);
            callback(null, (releasedCallback) => {
              if (lock2.released) {
                return releasedCallback && releasedCallback(Object.assign(new Error("Lock is already released"), { code: "ERELEASED" }));
              }
              unlock(file2, { ...options, realpath: false }, releasedCallback);
            });
          });
        });
      });
    }
    function unlock(file, options, callback) {
      options = {
        fs,
        realpath: true,
        ...options
      };
      resolveCanonicalPath(file, options, (err, file2) => {
        if (err) {
          return callback(err);
        }
        const lock2 = locks[file2];
        if (!lock2) {
          return callback(Object.assign(new Error("Lock is not acquired/owned by you"), { code: "ENOTACQUIRED" }));
        }
        lock2.updateTimeout && clearTimeout(lock2.updateTimeout);
        lock2.released = true;
        delete locks[file2];
        removeLock(file2, options, callback);
      });
    }
    function check(file, options, callback) {
      options = {
        stale: 1e4,
        realpath: true,
        fs,
        ...options
      };
      options.stale = Math.max(options.stale || 0, 2e3);
      resolveCanonicalPath(file, options, (err, file2) => {
        if (err) {
          return callback(err);
        }
        options.fs.stat(getLockFile(file2, options), (err2, stat4) => {
          if (err2) {
            return err2.code === "ENOENT" ? callback(null, false) : callback(err2);
          }
          return callback(null, !isLockStale(stat4, options));
        });
      });
    }
    function getLocks() {
      return locks;
    }
    onExit(() => {
      for (const file in locks) {
        const options = locks[file].options;
        try {
          options.fs.rmdirSync(getLockFile(file, options));
        } catch (e) {
        }
      }
    });
    module.exports.lock = lock;
    module.exports.unlock = unlock;
    module.exports.check = check;
    module.exports.getLocks = getLocks;
  }
});

// node_modules/proper-lockfile/lib/adapter.js
var require_adapter = __commonJS({
  "node_modules/proper-lockfile/lib/adapter.js"(exports, module) {
    "use strict";
    var fs = require_graceful_fs();
    function createSyncFs(fs2) {
      const methods = ["mkdir", "realpath", "stat", "rmdir", "utimes"];
      const newFs = { ...fs2 };
      methods.forEach((method) => {
        newFs[method] = (...args) => {
          const callback = args.pop();
          let ret;
          try {
            ret = fs2[`${method}Sync`](...args);
          } catch (err) {
            return callback(err);
          }
          callback(null, ret);
        };
      });
      return newFs;
    }
    function toPromise(method) {
      return (...args) => new Promise((resolve3, reject) => {
        args.push((err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve3(result);
          }
        });
        method(...args);
      });
    }
    function toSync(method) {
      return (...args) => {
        let err;
        let result;
        args.push((_err, _result) => {
          err = _err;
          result = _result;
        });
        method(...args);
        if (err) {
          throw err;
        }
        return result;
      };
    }
    function toSyncOptions(options) {
      options = { ...options };
      options.fs = createSyncFs(options.fs || fs);
      if (typeof options.retries === "number" && options.retries > 0 || options.retries && typeof options.retries.retries === "number" && options.retries.retries > 0) {
        throw Object.assign(new Error("Cannot use retries with the sync api"), { code: "ESYNC" });
      }
      return options;
    }
    module.exports = {
      toPromise,
      toSync,
      toSyncOptions
    };
  }
});

// node_modules/proper-lockfile/index.js
var require_proper_lockfile = __commonJS({
  "node_modules/proper-lockfile/index.js"(exports, module) {
    "use strict";
    var lockfile2 = require_lockfile();
    var { toPromise, toSync, toSyncOptions } = require_adapter();
    async function lock(file, options) {
      const release = await toPromise(lockfile2.lock)(file, options);
      return toPromise(release);
    }
    function lockSync(file, options) {
      const release = toSync(lockfile2.lock)(file, toSyncOptions(options));
      return toSync(release);
    }
    function unlock(file, options) {
      return toPromise(lockfile2.unlock)(file, options);
    }
    function unlockSync(file, options) {
      return toSync(lockfile2.unlock)(file, toSyncOptions(options));
    }
    function check(file, options) {
      return toPromise(lockfile2.check)(file, options);
    }
    function checkSync(file, options) {
      return toSync(lockfile2.check)(file, toSyncOptions(options));
    }
    module.exports = lock;
    module.exports.lock = lock;
    module.exports.unlock = unlock;
    module.exports.lockSync = lockSync;
    module.exports.unlockSync = unlockSync;
    module.exports.check = check;
    module.exports.checkSync = checkSync;
  }
});

// src/copilot/hook.ts
import { isAbsolute as isAbsolute4 } from "node:path";

// src/catalog.ts
import { open, readFile as readFile2, stat } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";

// src/cli.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";

// src/messages.ts
var MESSAGES = {
  // Shown text that came from outside (a provider's error, a file name): never translated.
  raw: "{text}",
  // Context notes: why something was left out.
  "note.no_workspace": "No focused workspace.",
  "note.workspace_unknown": "Could not tell which folder the workspace is in; project files skipped.",
  "note.remote": "Remote (SSH/WSL) workspace: project files are not readable from the plugin.",
  "note.terminal_off": "Terminal output is off in Settings.",
  "note.not_git": "Not a git repository: no git context.",
  "note.no_files": "No files matched the prompt; the agent will be told to locate them.",
  "note.project_files_off": "Project files are off in Settings: workspace and agent only.",
  "note.preview_no_picker": "Preview skips the AI file picker.",
  "note.picker_skipped": "AI file picker skipped: {reason}",
  // Context item titles and why an item is there.
  "label.workspace": "Workspace",
  "label.agent": "Target agent",
  "label.stack": "Stack & commands",
  "label.log": "Recent commits",
  "label.diff": "Uncommitted changes",
  "label.tree": "Repository tree ({count} files)",
  "label.status": "Git status ({count} changed)",
  "label.terminal": "Recent output: {name}",
  "label.agents": "Other agents in this workspace",
  "label.session": "Other agent session: {name}",
  "label.activity": "Recent agent activity",
  "label.saved": "Files you saved lately",
  "why.keyword": "keyword match",
  "why.ai": "picked by AI",
  "why.trimmed": "trimmed",
  // Errors and results.
  "error.no_prompt": "Write a prompt first.",
  "error.attachment_bad": "That attachment could not be received; try attaching it again.",
  "error.attachment_missing": "The attached file {name} is no longer there (attachments are kept for a day). Attach it again.",
  "error.file_too_large": "{name} is {size}; an attachment can be at most {max}.",
  "note.images_paths_only": "This model cannot see images: it got their paths only, and the prompt lists them for the agent.",
  "error.cancelled": "Cancelled.",
  "error.copilot_unavailable": "Copilot background rewriting is unavailable. Restart or update GitHub Copilot and reopen this plugin. No separate SDK or runtime is installed.",
  "error.copilot_runtime": "The plugin could not verify the desktop runtime. Open Show Logs and share the Copilot model discovery section.",
  "error.copilot_sdk": "The required desktop SDK could not be loaded. Open Show Logs and share the Copilot model discovery section.",
  "error.copilot_catalog": "Copilot could not return its model list. Try Refresh, then open Show Logs and share the Copilot model discovery section if it still fails.",
  "error.copilot_no_models": "No eligible Copilot models were returned for this session. Check your Copilot sign-in and model access, then refresh. Show Logs includes the model discovery results.",
  "error.copilot_account": "The background runtime could not verify the same GitHub account as this Copilot session. Check your existing Copilot sign-in. No prompt was sent.",
  "error.copilot_model": "This model is not available through GitHub Copilot in both sessions. Refresh the model list and choose a Copilot model.",
  "error.copilot_images": "This Copilot model does not report image support. Choose a model with image support or remove the images.",
  "error.send_off": "Sending to Copilot is off in Settings.",
  "error.session_not_idle": "Copilot is busy, waiting for your answer, or disconnected. Wait until the session is idle before sending.",
  "error.send_pending": "A prompt was just sent. Wait for Copilot before sending again.",
  "error.launch_off": "Starting new agents is off in Settings, or not confirmed yet.",
  "error.open_off": "Opening files in Copilot is off in Settings.",
  // Shown inside "Could not load the list (…)": no capital, no full stop.
  "error.lists_off": "online model lists are off in Settings",
  "error.key_not_saved": "Copilot could not store the API key: this machine has no key store for it. Use a key from an environment variable, or a subscription CLI.",
  "error.agent_blocked": "{name} is waiting for an answer from you, and what is typed now could be taken as that answer.",
  // Why auto-enhance let a prompt through unchanged (the Settings section shows the last one).
  "hook.no_model": "No enabled API model: Copilot helpers and subscription CLIs are excluded from the two-second chat hook.",
  "hook.empty": "The model returned no prompt.",
  "error.unsupported": "This version of Copilot cannot do that yet.",
  "error.invalid_request": "Invalid request.",
  "error.nothing_to_send": "Nothing to send.",
  "error.invalid_profile": "Invalid model profile.",
  "error.unknown_profile": "Unknown profile.",
  "result.test_ok": "{name} \xB7 {model} answered (key: {key}).",
  "error.bad_url": "Invalid API base URL: {url}",
  "error.https_only": "The API base URL must use https (http is allowed only for localhost).",
  "error.key_in_url": "Put the API key in the Models tab, not in the URL.",
  "error.timeout": "The request was cancelled or timed out.",
  "error.model_timeout": "{model} did not answer within {seconds} s.",
  "error.too_slow": "{reason} A lower context level or a faster model answers sooner.",
  "error.run_gone": "That run is no longer going (the plugin was restarted). Try again.",
  "error.stopped": "{url} stopped answering: {detail}",
  "error.not_json": "{url} did not answer with JSON ({what}). A proxy or sign-in page may be in the way.",
  "error.empty_body": "an empty answer",
  "error.no_key": "No API key. Add one in the Enhance Prompt panel (Models tab).",
  "error.no_key_env": "No API key. Add one in the Enhance Prompt panel (Models tab) or set {env}.",
  "error.unreachable": "Could not reach {url}: {detail}",
  "error.http": "{status}: {detail}",
  "error.empty_answer": "The model returned an empty answer.",
  "error.cut_off": "{model} reached its limit of {max} tokens before it finished. Raise Max tokens for this model in the Models tab.",
  "error.refused": "{model} declined this request ({category}). Use another model, or rephrase the request.",
  "error.unsafe_argument": "Unsafe argument for a .cmd launcher.",
  "error.cli_missing": "{name} was not found. Install it and sign in, or set its full path in the model.",
  "error.cli_start": "Could not start {binary}: {detail}",
  "error.cli_exit": "{kind} exited with {code}",
  "error.cli_exit_detail": "{kind} exited with {code}: {detail}",
  "error.cli_sign_in": "{text} (run it once in a terminal to sign in)",
  "error.cli_empty": "{kind} returned an empty answer.",
  "error.no_model": "No model configured. Add one in the Models tab.",
  "error.profile_no_key": "{name}: no API key",
  "error.all_failed": "All models failed. {list}",
  "error.attempt": "{name}: {reason}",
  "error.out_of_time": "Out of time."
};
var WIRE_OPEN = " [[message:";
var WIRE_CLOSE = "]]";
function withMessage(message) {
  return `${english(message)}${WIRE_OPEN}${encodeURIComponent(JSON.stringify(message))}${WIRE_CLOSE}`;
}
function messageIn(text) {
  const at = text.lastIndexOf(WIRE_OPEN);
  if (at < 0 || !text.endsWith(WIRE_CLOSE)) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(text.slice(at + WIRE_OPEN.length, text.length - WIRE_CLOSE.length)));
    return isMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function msg(code, params) {
  return params ? { code, params } : { code };
}
var raw = (text) => ({ code: "raw", params: { text } });
function isMessage(value) {
  return Boolean(value) && typeof value === "object" && typeof value.code === "string" && value.code in MESSAGES;
}
function render(message, lookup) {
  const param = (value) => {
    if (Array.isArray(value)) return value.map(param).join(" \xB7 ");
    if (isMessage(value)) return render(value, lookup);
    return String(value);
  };
  const params = {};
  for (const [key, value] of Object.entries(message.params ?? {})) params[key] = param(value);
  return lookup(MESSAGES[message.code], params);
}
var fill = (template, params) => template.replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
function english(message) {
  return render(message, fill);
}

// src/llm.ts
function tokenLimitField(baseUrl) {
  try {
    return new URL(baseUrl).hostname === "api.openai.com" ? "max_completion_tokens" : "max_tokens";
  } catch {
    return "max_tokens";
  }
}
var LlmError = class extends Error {
  code;
  /** HTTP status when the endpoint answered with an error. */
  status;
  /** The message as a code and parameters, for the panel to show in its language. */
  text;
  constructor(message, code = "action_failed", status) {
    const text = typeof message === "string" ? raw(message) : message;
    super(english(text));
    this.text = text;
    this.code = code;
    this.status = status;
  }
};
function messageOf(error) {
  if (error && typeof error === "object" && "text" in error && error.text) {
    const text = error.text;
    if (typeof text === "object" && typeof text.code === "string") return text;
  }
  return raw(error instanceof Error ? error.message : String(error));
}
function isTransient(error) {
  if (!(error instanceof LlmError)) {
    return false;
  }
  if (error.code === "timeout" || error.code === "unavailable" || error.code === "rate_limited") {
    return true;
  }
  return error.status !== void 0 && (error.status >= 500 || error.status === 408);
}
function isLocalUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}
function endpointUrl(base, path) {
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new LlmError(msg("error.bad_url", { url: base }), "invalid_params");
  }
  const local = isLocalUrl(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new LlmError(msg("error.https_only"), "invalid_params");
  }
  if (url.username || url.password) {
    throw new LlmError(msg("error.key_in_url"), "invalid_params");
  }
  url.search = "";
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}${path}`;
  return url;
}
async function readError(response) {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
    if (message) {
      return message;
    }
  } catch {
  }
  return body.slice(0, 300) || response.statusText;
}
async function readJson(response, baseUrl, signal) {
  let body;
  try {
    body = await response.text();
  } catch (error) {
    if (signal?.aborted) throw new LlmError(msg("error.timeout"), "timeout");
    throw new LlmError(msg("error.stopped", { url: baseUrl, detail: error.message }), "unavailable");
  }
  try {
    return JSON.parse(body);
  } catch {
    const type = response.headers.get("content-type")?.split(";")[0] || "no content type";
    const text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    const what = body.trim() ? raw(`${type}: "${text}"`) : msg("error.empty_body");
    throw new LlmError(msg("error.not_json", { url: baseUrl, what }), "unavailable");
  }
}
async function complete(config, system, user, signal, images = []) {
  if (!config.apiKey && !(config.provider === "openai" && isLocalUrl(config.baseUrl))) {
    throw new LlmError(
      config.envName ? msg("error.no_key_env", { env: config.envName }) : msg("error.no_key"),
      "invalid_params"
    );
  }
  let response;
  try {
    response = config.provider === "anthropic" ? await fetch(endpointUrl(config.baseUrl, "/v1/messages"), {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01"
      },
      // No sampling parameters (temperature, top_p): current Claude models refuse a request
      // that sets them, and the prompt says how to write.
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system,
        messages: [
          {
            role: "user",
            content: images.length === 0 ? user : [
              ...images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } })),
              { type: "text", text: user }
            ]
          }
        ]
      })
    }) : await fetch(endpointUrl(config.baseUrl, "/chat/completions"), {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}
      },
      body: JSON.stringify({
        model: config.model,
        [tokenLimitField(config.baseUrl)]: config.maxTokens,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: images.length === 0 ? user : [
              { type: "text", text: user },
              ...images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.type};base64,${image.base64}` } }))
            ]
          }
        ]
      })
    });
  } catch (error) {
    if (error instanceof LlmError) {
      throw error;
    }
    if (signal?.aborted) {
      throw new LlmError(msg("error.timeout"), "timeout");
    }
    throw new LlmError(msg("error.unreachable", { url: config.baseUrl, detail: error.message }), "unavailable");
  }
  if (!response.ok) {
    const code = response.status === 429 ? "rate_limited" : "action_failed";
    throw new LlmError(msg("error.http", { status: response.status, detail: await readError(response) }), code, response.status);
  }
  const data = await readJson(response, config.baseUrl, signal);
  if (config.provider === "anthropic" && data.stop_reason === "refusal") {
    const category = typeof data.stop_details?.category === "string" ? data.stop_details.category.slice(0, 40) : "refusal";
    throw new LlmError(msg("error.refused", { model: config.model, category }));
  }
  const cutOff = config.provider === "anthropic" ? data.stop_reason === "max_tokens" : data.choices?.[0]?.finish_reason === "length";
  if (cutOff) {
    throw new LlmError(msg("error.cut_off", { model: config.model, max: config.maxTokens }));
  }
  let text = "";
  if (config.provider === "anthropic") {
    text = (data.content ?? []).map((part) => part.type === "text" ? part.text ?? "" : "").join("");
  } else {
    const content = data.choices?.[0]?.message?.content;
    text = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content ?? "";
  }
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!text) {
    throw new LlmError(msg("error.empty_answer"));
  }
  return text;
}

// src/cli.ts
var CLI_BINARIES = {
  "claude-code": "claude",
  codex: "codex",
  "gemini-cli": "gemini"
};
var SAFE_TOKEN = /^[\w.:/=@+,-]{1,200}$/;
function extraDirs() {
  const home = homedir();
  const dirs = [
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    join(home, ".npm-global", "bin"),
    join(home, ".bun", "bin"),
    join(home, ".volta", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin"
  ];
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    const roaming = process.env.APPDATA ?? join(home, "AppData", "Roaming");
    dirs.push(join(roaming, "npm"), join(local, "Programs", "OpenAI", "Codex", "bin"), join(local, "pnpm"));
  }
  return dirs;
}
function resolveBinary(nameOrPath) {
  if (/[/\\]/.test(nameOrPath)) {
    return existsSync(nameOrPath) ? nameOrPath : null;
  }
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  const dirs = [...(process.env.PATH ?? "").split(delimiter).filter(Boolean), ...extraDirs()];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = join(dir, nameOrPath + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}
function detectClis() {
  const out = [];
  for (const [kind, name] of Object.entries(CLI_BINARIES)) {
    const path = resolveBinary(name);
    if (path) out.push({ kind, path });
  }
  return out;
}
var INSTRUCTION = "Follow the instructions in the input exactly and output only the final prompt.";
var NOT_THE_PROJECT = "You are running in an empty temporary folder that is not the user's project. What you know about your own working directory, whether it is a git repository, your platform, your shell or your tools says nothing about that project: never mention it and never rely on it. The agent that receives your prompt works inside the user's project and can read all of it.";
function cliArgs(kind, model, outFile, customArgs, images = []) {
  const m = model && SAFE_TOKEN.test(model) ? model : "";
  switch (kind) {
    case "claude-code":
      return [
        "-p",
        "--output-format",
        "text",
        "--tools",
        "",
        "--no-session-persistence",
        "--setting-sources",
        "",
        "--system-prompt",
        INSTRUCTION,
        ...m ? ["--model", m] : []
      ];
    case "codex":
      return [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--ignore-rules",
        "--color",
        "never",
        "-o",
        outFile,
        ...m ? ["-m", m] : [],
        // Pictures attached to the prompt (checked image files on this machine).
        ...images.flatMap((path) => ["-i", path]),
        "-"
      ];
    case "gemini-cli":
      return ["-p", INSTRUCTION, ...m ? ["-m", m] : []];
    case "custom-cli":
      return customArgs.split(/\s+/).filter(Boolean).filter((token) => SAFE_TOKEN.test(token));
  }
}
function cmdQuote(arg) {
  if (/["%^&|<>!\r\n]/.test(arg)) throw new LlmError(msg("error.unsafe_argument"), "invalid_params");
  return arg === "" || /\s/.test(arg) ? `"${arg}"` : arg;
}
function killTree(child) {
  const pid = child.pid;
  if (pid === void 0 || child.exitCode !== null || child.signalCode !== null) {
    child.kill();
    return;
  }
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => child.kill());
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    child.kill();
  }
}
var GROUP = process.platform === "win32" ? {} : { detached: true };
function readCommand(binary, args, timeoutMs = 2e4) {
  const isCmd = process.platform === "win32" && /\.(cmd|bat)$/i.test(binary);
  return new Promise((resolve3) => {
    let child;
    try {
      child = isCmd ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${[cmdQuote(binary), ...args.map(cmdQuote)].join(" ")}"`], {
        windowsHide: true,
        windowsVerbatimArguments: true,
        stdio: ["ignore", "pipe", "ignore"]
      }) : spawn(binary, args, { ...GROUP, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      resolve3(null);
      return;
    }
    let out = "";
    const timer = setTimeout(() => {
      killTree(child);
      resolve3(null);
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      if (out.length < 8e6) out += chunk;
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve3(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve3(code === 0 ? out : null);
    });
  });
}
async function runCli(options, system, user, signal) {
  const binary = resolveBinary(options.command || (options.kind === "custom-cli" ? "" : CLI_BINARIES[options.kind]));
  if (!binary) {
    throw new LlmError(msg("error.cli_missing", { name: options.command || options.kind }), "unavailable");
  }
  const cwd = await mkdtemp(join(tmpdir(), "enhance-prompt-"));
  const outFile = join(cwd, "last-message.txt");
  const args = cliArgs(options.kind, options.model, outFile, options.customArgs, options.images ?? []);
  const input = `<instructions>
${system}

${NOT_THE_PROJECT}
</instructions>

${user}`;
  const isCmd = process.platform === "win32" && /\.(cmd|bat)$/i.test(binary);
  const cancelled = () => new LlmError(msg("error.timeout"), "timeout");
  try {
    const stdout = await new Promise((resolve3, reject) => {
      if (signal?.aborted) {
        reject(cancelled());
        return;
      }
      const child = isCmd ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${[cmdQuote(binary), ...args.map(cmdQuote)].join(" ")}"`], {
        cwd,
        windowsHide: true,
        windowsVerbatimArguments: true,
        stdio: ["pipe", "pipe", "pipe"]
      }) : spawn(binary, args, { ...GROUP, cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        if (out.length < 2e6) out += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        if (err.length < 2e4) err += chunk;
      });
      const onAbort = () => {
        killTree(child);
        reject(cancelled());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      child.on("error", (error) => {
        signal?.removeEventListener("abort", onAbort);
        reject(new LlmError(msg("error.cli_start", { binary, detail: error.message }), "unavailable"));
      });
      child.on("close", (code) => {
        signal?.removeEventListener("abort", onAbort);
        if (signal?.aborted) {
          reject(cancelled());
        } else if (code === 0) {
          resolve3(out);
        } else {
          const detail = (err || out).trim().split("\n").slice(-3).join(" ").slice(0, 300);
          const auth = /log ?in|auth|sign in|credential|unauthori[sz]ed|401/i.test(detail);
          const exited = detail ? msg("error.cli_exit_detail", { kind: options.kind, code: String(code), detail: raw(detail) }) : msg("error.cli_exit", { kind: options.kind, code: String(code) });
          reject(
            new LlmError(
              auth ? msg("error.cli_sign_in", { text: exited }) : exited,
              /limit|quota|429|rate/i.test(detail) ? "rate_limited" : "action_failed"
            )
          );
        }
      });
      child.stdin.on("error", () => void 0);
      child.stdin.end(input);
    });
    const text = options.kind === "codex" ? await readFile(outFile, "utf8").catch(() => stdout) : stdout;
    const clean = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!clean) throw new LlmError(msg("error.cli_empty", { kind: options.kind }));
    return clean;
  } finally {
    const removal = rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => void 0);
    if (!signal?.aborted) await removal;
  }
}

// src/catalog.ts
function parseCatalog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw2 = value;
  if (typeof raw2.fetchedAt !== "number" || !Array.isArray(raw2.models)) return null;
  const models = [];
  for (const item2 of raw2.models) {
    if (!item2 || typeof item2 !== "object") continue;
    const model = item2;
    if (typeof model.id !== "string") continue;
    models.push({
      id: model.id,
      label: typeof model.label === "string" ? model.label : model.id,
      ...typeof model.description === "string" ? { description: model.description } : {},
      ...model.isDefault === true ? { isDefault: true } : {}
    });
  }
  return { models, source: typeof raw2.source === "string" ? raw2.source : "cache", fetchedAt: raw2.fetchedAt };
}
var CLAUDE_SCHEMA_URL = "https://www.schemastore.org/claude-code-settings.json";
var CLAUDE_ALIAS_INFO = {
  default: "Account default",
  opus: "Opus, newest",
  sonnet: "Sonnet, newest",
  haiku: "Haiku, newest (fastest)",
  fable: "Fable, newest",
  opusplan: "Opus plans, Sonnet writes"
};
var NOT_ALIASES = /* @__PURE__ */ new Set(["model", "models", "alias", "none", "null", "true", "false", "auto", "string"]);
async function readJson2(path) {
  try {
    return JSON.parse(await readFile2(path, "utf8"));
  } catch {
    return null;
  }
}
function aliasesFromText(text) {
  const found = /* @__PURE__ */ new Set();
  for (const hit of text.matchAll(/alias/gi)) {
    const window = text.slice(hit.index, hit.index + 160);
    for (const match of window.matchAll(/["'\u2018\u201c]([a-z][a-z0-9-]{2,20})["'\u2019\u201d]/g)) {
      if (!NOT_ALIASES.has(match[1])) found.add(match[1]);
    }
  }
  return [...found];
}
async function fetchJson(url, init, timeoutMs = 8e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
function parseClaudeModelTable(text) {
  const found = /* @__PURE__ */ new Map();
  const pattern = /\{id:"(claude-[a-z0-9-]{3,60})",name:"([^"]{2,40})",short_name:"[^"]{1,30}"(?:,description:"([^"]{0,120})")?,section:"(main|overflow)"/g;
  for (const match of text.matchAll(pattern)) {
    const [, id2, name, description, section] = match;
    const entry = { id: id2, name, main: section === "main" };
    if (description) entry.description = description;
    mergeModel(found, entry);
  }
  return [...found.values()].sort((a, b) => Number(b.main) - Number(a.main));
}
var PROVIDER_ID = /anthropic\.(claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d))?)(?![a-z0-9@-]|-v\d)/g;
function parseProviderIds(text) {
  const found = /* @__PURE__ */ new Map();
  for (const match of text.matchAll(PROVIDER_ID)) {
    const [, id2, family, major, minor] = match;
    if (Number(major) > 20) continue;
    const version = Number(major) + (minor ? Number(minor) / 10 : 0);
    found.set(id2, { id: id2, family, version, name: `${family[0].toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ""}` });
  }
  return [...found.values()];
}
var menuVersion = (id2) => {
  const match = /^claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d))?$/.exec(id2);
  return match ? { family: match[1], version: Number(match[2]) + (match[3] ? Number(match[3]) / 10 : 0) } : null;
};
function newerThanMenu(menu, provider) {
  const best = /* @__PURE__ */ new Map();
  for (const model of menu) {
    const parsed = menuVersion(model.id);
    if (parsed) best.set(parsed.family, Math.max(best.get(parsed.family) ?? 0, parsed.version));
  }
  return provider.filter((entry) => best.has(entry.family) && entry.version > (best.get(entry.family) ?? 0)).sort((a, b) => b.version - a.version).map((entry) => ({ id: entry.id, name: entry.name, description: "Newest", main: true }));
}
function mergeModel(entries, entry) {
  const previous = entries.get(entry.id);
  if (!previous) {
    entries.set(entry.id, { ...entry });
    return;
  }
  if (entry.description && !previous.description) previous.description = entry.description;
  previous.main = previous.main || entry.main;
}
var TABLE_MARKER = Buffer.from('short_name:"', "latin1");
var PROVIDER_MARKER = Buffer.from("anthropic.claude-", "latin1");
var BEFORE = 160;
var AFTER = 320;
var tableMemo = null;
async function claudeModelTable(binary) {
  try {
    const info = await stat(binary);
    if (!info.isFile() || info.size > 800 * 1024 * 1024) return [];
    const signature = `${binary}:${info.size}:${info.mtimeMs}`;
    if (tableMemo?.signature === signature) return tableMemo.models.map((model) => ({ ...model }));
    const models = await scanModelTable(binary, info.size);
    tableMemo = { signature, models };
    return models.map((model) => ({ ...model }));
  } catch {
    return [];
  }
}
async function scanModelTable(binary, fileSize) {
  const handle = await open(binary, "r");
  try {
    const size = 8 * 1024 * 1024;
    const overlap = BEFORE + AFTER;
    const buffer = Buffer.alloc(size);
    const entries = /* @__PURE__ */ new Map();
    const provider = /* @__PURE__ */ new Map();
    for (let position = 0; position < fileSize; position += size - overlap) {
      const { bytesRead } = await handle.read(buffer, 0, size, position);
      if (bytesRead === 0) break;
      const view2 = buffer.subarray(0, bytesRead);
      for (let hit = view2.indexOf(TABLE_MARKER); hit !== -1; hit = view2.indexOf(TABLE_MARKER, hit + TABLE_MARKER.length)) {
        const window = view2.toString("latin1", Math.max(0, hit - BEFORE), Math.min(bytesRead, hit + AFTER));
        for (const entry of parseClaudeModelTable(window)) mergeModel(entries, entry);
      }
      for (let hit = view2.indexOf(PROVIDER_MARKER); hit !== -1; hit = view2.indexOf(PROVIDER_MARKER, hit + PROVIDER_MARKER.length)) {
        for (const entry of parseProviderIds(view2.toString("latin1", hit, Math.min(bytesRead, hit + 48)))) provider.set(entry.id, entry);
      }
      if (position + bytesRead >= fileSize) break;
    }
    const menu = [...entries.values()].sort((a, b) => Number(b.main) - Number(a.main));
    return [...newerThanMenu(menu, [...provider.values()]), ...menu];
  } finally {
    await handle.close();
  }
}
var helpMemo = null;
async function claudeHelpAliases(binary) {
  const info = await stat(binary).catch(() => null);
  const signature = info ? `${binary}:${info.size}:${info.mtimeMs}` : binary;
  if (helpMemo?.signature === signature) return helpMemo.aliases;
  const help = await readCommand(binary, ["--help"], 1e4);
  if (help === null) return null;
  const at = help.indexOf("--model");
  const aliases = at >= 0 ? aliasesFromText(help.slice(at, at + 400).replace(/\s+/g, " ")) : null;
  helpMemo = { signature, aliases };
  return aliases;
}
async function claudeProgramSignature(command) {
  const binary = resolveBinary(command || CLI_BINARIES["claude-code"]);
  const info = binary ? await stat(binary).catch(() => null) : null;
  return info ? `${info.size}-${Math.round(info.mtimeMs)}` : "none";
}
async function claudeCatalog(command, online = true) {
  const aliases = /* @__PURE__ */ new Set(["default", "opus", "sonnet", "haiku"]);
  const sources = ["built-in"];
  const binary = resolveBinary(command || CLI_BINARIES["claude-code"]);
  const exact = binary ? await claudeModelTable(binary) : [];
  if (exact.length > 0) sources.push("Claude Code model table");
  if (binary) {
    const helpAliases = await claudeHelpAliases(binary);
    if (helpAliases) {
      helpAliases.forEach((alias) => aliases.add(alias));
      sources.push("claude --help");
    }
  }
  if (online) try {
    const schema = await fetchJson(CLAUDE_SCHEMA_URL, {});
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (/model/i.test(key) && property.description) aliasesFromText(property.description).forEach((alias) => aliases.add(alias));
    }
    sources.push("schemastore");
  } catch {
  }
  const settings = await readJson2(join2(homedir2(), ".claude", "settings.json"));
  const current = typeof settings?.model === "string" ? settings.model : null;
  if (current) aliases.add(current);
  const env = settings?.env ?? {};
  for (const key of ["ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL"]) {
    if (typeof env[key] === "string") aliases.add(env[key]);
  }
  let list = [...aliases];
  const allowed = Array.isArray(settings?.availableModels) ? settings.availableModels.filter((m) => typeof m === "string") : [];
  if (allowed.length > 0) list = list.filter((alias) => alias === "default" || allowed.includes(alias));
  const order = ["haiku", "sonnet", "opus", "fable", "opusplan", "default"];
  list.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const exactAllowed = allowed.length > 0 ? exact.filter((model) => allowed.includes(model.id)) : exact;
  return {
    models: [
      ...exactAllowed.map((model) => ({
        id: model.id,
        label: model.name,
        ...model.description ? { description: model.description } : {},
        ...model.id === current ? { isDefault: true } : {}
      })),
      ...list.map((id2) => ({
        id: id2,
        label: CLAUDE_ALIAS_INFO[id2] ? `${id2}: ${CLAUDE_ALIAS_INFO[id2]}` : id2,
        ...id2 === current ? { isDefault: true, description: "Your Claude Code default" } : {}
      }))
    ],
    source: sources.join(" + "),
    fetchedAt: Date.now()
  };
}
async function codexCatalog(command) {
  const binary = resolveBinary(command || CLI_BINARIES.codex);
  if (!binary) return { models: [], source: "codex", fetchedAt: Date.now(), error: "codex not found" };
  const out = await readCommand(binary, ["debug", "models"], 2e4);
  const config = await readFile2(join2(homedir2(), ".codex", "config.toml"), "utf8").catch(() => "");
  const current = /^\s*model\s*=\s*"([^"]+)"/m.exec(config)?.[1] ?? null;
  let models = [];
  try {
    const parsed = JSON.parse(out ?? "");
    models = (parsed.models ?? []).filter((model) => model.visibility === "list").sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).flatMap((model) => {
      if (!model.slug) return [];
      const entry = { id: model.slug, label: model.display_name ?? model.slug };
      if (model.description) entry.description = model.description;
      if (model.slug === current) entry.isDefault = true;
      return [entry];
    });
  } catch {
    return { models: [], source: "codex debug models", fetchedAt: Date.now(), error: "could not read the Codex model catalog" };
  }
  if (current && !models.some((model) => model.id === current)) models.unshift({ id: current, label: current, isDefault: true });
  return { models, source: "codex debug models", fetchedAt: Date.now() };
}
function parseGeminiModels(out) {
  if (!out) return null;
  const start = out.indexOf("[");
  if (start < 0) return null;
  try {
    const list = JSON.parse(out.slice(start));
    if (!Array.isArray(list)) return null;
    const models = [];
    for (const entry of list) {
      const id2 = entry.modelId ?? entry.id;
      if (typeof id2 !== "string" || !id2) continue;
      const name = entry.displayName ?? entry.name;
      const model = { id: id2, label: name && name !== id2 ? `${name} (${id2})` : id2 };
      if (entry.description) model.description = entry.description;
      models.push(model);
    }
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
}
var GEMINI_KNOWN = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
async function geminiCatalog(command = "", online = true) {
  const settings = await readJson2(join2(homedir2(), ".gemini", "settings.json"));
  const configured = settings?.model?.name;
  const binary = online ? resolveBinary(command || CLI_BINARIES["gemini-cli"]) : null;
  const listed = binary ? parseGeminiModels(await readCommand(binary, ["models", "list", "--output-format", "json"], 2e4)) : null;
  const models = listed ?? GEMINI_KNOWN.map((id2) => ({ id: id2, label: id2 }));
  if (configured && !models.some((model) => model.id === configured)) models.unshift({ id: configured, label: configured });
  for (const model of models) if (model.id === configured) model.isDefault = true;
  return {
    models,
    source: listed ? "gemini models list + ~/.gemini/settings.json" : "built-in + ~/.gemini/settings.json",
    fetchedAt: Date.now()
  };
}
async function apiCatalog(provider, baseUrl, apiKey) {
  try {
    if (provider === "anthropic") {
      const data2 = await fetchJson(endpointUrl(baseUrl, "/v1/messages").href.replace(/\/v1\/messages$/, "/v1/models?limit=100"), {
        headers: { "x-api-key": apiKey ?? "", "anthropic-version": "2023-06-01" }
      });
      return {
        models: (data2.data ?? []).map((model) => ({ id: model.id, label: model.display_name ? `${model.display_name} (${model.id})` : model.id })),
        source: "GET /v1/models",
        fetchedAt: Date.now()
      };
    }
    const url = endpointUrl(baseUrl, "/chat/completions").href.replace(/\/chat\/completions$/, "/models");
    const data = await fetchJson(url, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {} });
    const models = (data.data ?? []).filter((model) => typeof model.id === "string").sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id)).slice(0, 400).map((model) => ({ id: model.id, label: model.name && model.name !== model.id ? `${model.name} (${model.id})` : model.id }));
    return { models, source: "GET /models", fetchedAt: Date.now() };
  } catch (error) {
    return { models: [], source: "GET /models", fetchedAt: Date.now(), error: error.message };
  }
}

// src/clipboard.ts
import { spawn as spawn2 } from "node:child_process";
var utf8 = (text) => Buffer.from(text, "utf8");
var utf16 = (text) => Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, "utf16le")]);
function clipboardTools(platform) {
  if (platform === "win32") {
    return [{ command: "clip.exe", args: [], encode: utf16 }];
  }
  if (platform === "darwin") {
    return [{ command: "pbcopy", args: [], encode: utf8 }];
  }
  return [
    { command: "wl-copy", args: [], encode: utf8 },
    { command: "xclip", args: ["-selection", "clipboard"], encode: utf8 },
    { command: "xsel", args: ["--clipboard", "--input"], encode: utf8 }
  ];
}
function run(tool, text) {
  return new Promise((resolve3, reject) => {
    const child = spawn2(tool.command, tool.args, {
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
      env: { ...process.env, LANG: process.env.LANG || "en_US.UTF-8" }
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${tool.command} timed out`));
    }, 5e3);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve3();
      } else {
        reject(new Error(`${tool.command} exited with ${code}`));
      }
    });
    child.stdin.end(tool.encode(text));
  });
}
async function copyToClipboard(text, platform = process.platform) {
  let lastError = "no clipboard tool found";
  for (const tool of clipboardTools(platform)) {
    try {
      await run(tool, text);
      return { copied: true };
    } catch (error) {
      lastError = error.message;
    }
  }
  return { copied: false, error: lastError };
}

// src/workspaces.ts
function pathInWorkspaceId(id2) {
  const at = id2.indexOf("::");
  return at > 0 && at + 2 < id2.length ? id2.slice(at + 2) : null;
}
function pathKey(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
function namesWorkspace(id2, workspace) {
  if (id2 === workspace.id) return true;
  const path = pathInWorkspaceId(id2);
  return path !== null && pathKey(path) === pathKey(workspace.path);
}
function workspaceKey(id2) {
  const path = pathInWorkspaceId(id2);
  return path === null ? `id:${id2}` : `path:${pathKey(path)}`;
}
function workspaceKeys(workspace) {
  return [.../* @__PURE__ */ new Set([workspaceKey(workspace.id), `path:${pathKey(workspace.path)}`])];
}
function workspaceTitle(displayName, project) {
  const name = project?.trim();
  return name && name.toLowerCase() !== displayName.trim().toLowerCase() ? `${name}: ${displayName}` : displayName;
}

// src/context/secrets.ts
var DASHED_KEY = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g;
var SECRET_PATTERNS = [
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bnpm_[A-Za-z0-9]{36}\b/g,
  // Not `\b` at the end: a key may end in "-", after which no word boundary follows.
  /\bAIza[0-9A-Za-z_-]{35}(?![\w-])/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g
];
var SECRET_NAME = "[A-Za-z0-9_]*(?:(?:api|private|access|auth|encryption|signing)[_-]?key|token|secret|passw(?:or)?d|credential)[A-Za-z0-9_]*";
var SECRET_ASSIGNMENT = new RegExp(`\\b(${SECRET_NAME})(["']?\\s*[:=]\\s*["']?)([^\\s"',;]{6,})`, "gi");
var GIVEN = `["']?\\]?\\s*(?::\\s*[A-Za-z_][\\w.<>\\[\\]|? ]{0,40}?\\s*=|:=|=>|[:=])\\s*`;
var SECRET_LITERAL = new RegExp(`\\b(${SECRET_NAME}${GIVEN})(["'\`])([^"'\`\\s]{12,})\\2`, "gi");
var masked = (match) => `[redacted]${"\n".repeat(match.split("\n").length - 1)}`;
function maskFormats(text) {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, masked);
  return out;
}
function redactSecrets(text) {
  return maskFormats(text.replace(DASHED_KEY, "[redacted]")).replace(
    SECRET_ASSIGNMENT,
    (match, name, sep2, value) => /tokens$/i.test(name) && /^\d+[\]})]*$/.test(value) ? match : `${name}${sep2}[redacted]`
  );
}
var PLAIN_URL = /^[a-z][a-z0-9+.-]*:\/\/[^@]*$/i;
function redactCode(text) {
  const keys = text.replace(DASHED_KEY, (match, offset) => /\d/.test(match) && !/[\w-]/.test(text[offset - 1] ?? "") ? "[redacted]" : match);
  return maskFormats(keys).replace(
    SECRET_LITERAL,
    (match, lead, quote, value) => /[A-Za-z]/.test(value) && /\d/.test(value) && !PLAIN_URL.test(value) ? `${lead}${quote}[redacted]${quote}` : match
  );
}

// src/context/agents.ts
var MAX_SESSIONS = 4;
var SESSION_LINES = 80;
var SESSION_CHARS = 2500;
var sessionChars = (lines) => lines <= SESSION_LINES ? SESSION_CHARS : Math.min(8e3, lines * 32);
function since(at, now) {
  const minutes = Math.max(0, Math.round((now - at) / 6e4));
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}
async function otherAgents(host, except, signal) {
  if (!host.host.has("agents.list")) return [];
  const listed = await host.host.call("agents.list", {}, signal ? { signal } : void 0).catch(() => null);
  const order = { working: 0, blocked: 1, waiting: 2, done: 3 };
  return (listed?.agents ?? []).filter((entry) => Boolean(entry.terminalId) && entry.terminalId !== except).sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9) || b.stateStartedAt - a.stateStartedAt).map((entry) => ({ terminalId: entry.terminalId, agent: entry.agent, title: entry.title, state: entry.state, stateStartedAt: entry.stateStartedAt }));
}
function agentsSummary(agents, now = Date.now()) {
  return agents.map((entry) => `- ${entry.agent ?? "agent"} \xB7 ${entry.title ?? entry.terminalId} \xB7 ${entry.state} for ${since(entry.stateStartedAt, now)}`).join("\n");
}
async function readSession(host, terminalId, signal, lines = SESSION_LINES) {
  if (!host.host.has("terminal.read")) return "";
  const read = await host.host.call("terminal.read", { terminalId, maxLines: lines }, signal ? { signal } : void 0).catch(() => null);
  const text = redactSecrets((read?.lines ?? []).map((line) => line.trimEnd()).filter(Boolean).slice(-lines).join("\n"));
  const chars = sessionChars(lines);
  return text.length > chars ? `\u2026
${text.slice(-chars)}` : text;
}

// src/context/activity.ts
var MAX_ENTRIES = 60;
var KEEP_MS = 45 * 6e4;
var TARGET_CHARS = 160;
var byWorkspace = /* @__PURE__ */ new Map();
function push(workspaceId, entry) {
  if (!workspaceId) return;
  const key = workspaceKey(workspaceId);
  const list = byWorkspace.get(key) ?? [];
  list.push(entry);
  const cutoff = entry.at - KEEP_MS;
  byWorkspace.set(key, list.filter((item2) => item2.at >= cutoff).slice(-MAX_ENTRIES));
}
function toolTarget(input) {
  if (typeof input === "string") return redactSecrets(input).slice(0, TARGET_CHARS);
  if (!input || typeof input !== "object" || Array.isArray(input)) return "";
  const fields = input;
  for (const key of ["file_path", "filePath", "path", "notebook_path", "command", "cmd", "pattern", "query", "url"]) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return redactSecrets(value.replace(/\s+/g, " ").trim()).slice(0, TARGET_CHARS);
    if (Array.isArray(value) && value.every((part) => typeof part === "string")) return redactSecrets(value.join(" ")).slice(0, TARGET_CHARS);
  }
  return "";
}
function recordTool(event, now = Date.now()) {
  push(event.workspaceId, { kind: "tool", at: now, agent: event.agent, tool: event.tool, target: toolTarget(event.input) });
}
function recordStatus(event, now = Date.now()) {
  if (event.state !== "done" && event.state !== "blocked") return;
  push(event.workspaceId, { kind: "status", at: now, title: event.title ?? "agent", state: event.state, ...event.mainAgent?.outcome ? { outcome: event.mainAgent.outcome } : {} });
}
function recordSave(event, now = Date.now()) {
  push(event.workspaceId, { kind: "save", at: now, path: event.path });
}
function forgetActivity(kind) {
  for (const [id2, list] of byWorkspace) {
    const kept = kind === void 0 ? [] : list.filter((item2) => kind === "saves" ? item2.kind !== "save" : item2.kind === "save");
    if (kept.length > 0) byWorkspace.set(id2, kept);
    else byWorkspace.delete(id2);
  }
}
var ago = (at, now) => {
  const minutes = Math.max(0, Math.round((now - at) / 6e4));
  return minutes === 0 ? "just now" : `${minutes} min ago`;
};
function entriesOf(workspace) {
  return workspaceKeys(workspace).flatMap((key) => byWorkspace.get(key) ?? []).sort((a, b) => a.at - b.at);
}
function agentActivity(workspace, now = Date.now()) {
  const list = entriesOf(workspace).filter((item2) => item2.kind !== "save" && now - item2.at <= KEEP_MS);
  return list.map(
    (item2) => item2.kind === "tool" ? `- ${ago(item2.at, now)} \xB7 ${item2.agent} \xB7 ${item2.tool}${item2.target ? `: ${item2.target}` : ""}` : item2.kind === "status" ? `- ${ago(item2.at, now)} \xB7 session "${item2.title}" ${item2.state}${item2.outcome ? ` (${item2.outcome})` : ""}` : ""
  ).filter(Boolean).join("\n");
}
function savedFiles(workspace, now = Date.now()) {
  const list = entriesOf(workspace).filter((item2) => item2.kind === "save" && now - item2.at <= KEEP_MS);
  return [...new Set(list.reverse().map((item2) => item2.path))].slice(0, 20);
}

// src/context/files.ts
import { readdir, readFile as readFile3, realpath, stat as stat2 } from "node:fs/promises";
import { isAbsolute, join as join3, relative, sep } from "node:path";
var WALK_SKIP = /* @__PURE__ */ new Set([
  ".git",
  "node_modules",
  ".copilot",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
  "__pycache__",
  ".cache",
  "coverage",
  "vendor",
  ".idea",
  ".vscode",
  ".turbo",
  ".svelte-kit",
  "Pods"
]);
function isSensitive(path) {
  const name = path.split("/").pop() ?? path;
  return /^\.env(\..*)?$/i.test(name) || /\.(pem|key|p12|pfx|keystore|jks)$/i.test(name) || /(^|[._-])(secret|secrets|credentials?)([._-]|$)/i.test(name) || /^id_(rsa|ed25519|ecdsa)/.test(name);
}
var BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tgz|7z|rar|jar|exe|dll|so|dylib|wasm|woff2?|ttf|otf|mp[34]|mov|avi|bin|dat|db|sqlite)$/i;
function isBinaryPath(path) {
  return BINARY.test(path);
}
function compilePatterns(lines) {
  return lines.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((pattern) => {
    const dirOnly = pattern.endsWith("/");
    const body = pattern.replace(/\/$/, "");
    const escaped = body.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*");
    if (body.includes("/")) {
      return new RegExp(`^${escaped}${dirOnly ? "/" : "(/|$)"}`, "i");
    }
    return new RegExp(`(^|/)${escaped}${dirOnly ? "/" : "(/|$)"}`, "i");
  });
}
function isExcluded(path, patterns) {
  return patterns.some((pattern) => pattern.test(path));
}
async function walkFiles(root, maxFiles = 8e3, maxDepth = 6, signal) {
  const out = [];
  async function visit(dir, depth) {
    if (out.length >= maxFiles || depth > maxDepth || signal?.aborted) {
      return;
    }
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) {
        return;
      }
      if (entry.isDirectory()) {
        if (!WALK_SKIP.has(entry.name) && !entry.name.startsWith(".")) {
          await visit(join3(dir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        out.push(relative(root, join3(dir, entry.name)).split(sep).join("/"));
      }
    }
  }
  await visit(root, 0);
  return out;
}
function treeSummary(files, maxLines = 70) {
  const dirs = /* @__PURE__ */ new Map();
  const topFiles = [];
  for (const file of files) {
    const parts = file.split("/");
    if (parts.length === 1) {
      topFiles.push(file);
      continue;
    }
    dirs.set(`${parts[0]}/`, (dirs.get(`${parts[0]}/`) ?? 0) + 1);
    if (parts.length > 2) {
      const sub = `${parts[0]}/${parts[1]}/`;
      dirs.set(sub, (dirs.get(sub) ?? 0) + 1);
    }
  }
  const lines = [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dir, count]) => `${dir.split("/").length > 2 ? "  " : ""}${dir} (${count})`);
  const all = [...lines, ...topFiles.sort((a, b) => a.localeCompare(b))];
  return all.length > maxLines ? `${all.slice(0, maxLines).join("\n")}
\u2026(${all.length - maxLines} more)` : all.join("\n");
}
async function readText(root, path, maxBytes = 2e5) {
  if (isSensitive(path) || isBinaryPath(path) || path.includes("..")) {
    return null;
  }
  try {
    const full = join3(root, path);
    const info = await stat2(full);
    if (!info.isFile() || info.size > maxBytes) {
      return null;
    }
    const actual = relative(await realpath(root), await realpath(full)).split(sep).join("/");
    if (actual.startsWith("..") || isAbsolute(actual) || isSensitive(actual)) {
      return null;
    }
    const text = await readFile3(full, "utf8");
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
}
function snippet(text, hits, maxChars) {
  const lines = text.split(/\r?\n/);
  const keep = /* @__PURE__ */ new Set();
  if (hits.length === 0) {
    for (let i = 0; i < Math.min(lines.length, 40); i++) keep.add(i);
  } else {
    for (const hit of hits.slice(0, 6)) {
      for (let i = Math.max(0, hit - 5); i < Math.min(lines.length, hit + 2); i++) keep.add(i);
    }
  }
  const out = [];
  let last = -2;
  let size = 0;
  for (const i of [...keep].sort((a, b) => a - b)) {
    const line = `${i + 1}: ${lines[i].slice(0, 240)}`;
    if (size + line.length > maxChars) {
      out.push("\u2026");
      break;
    }
    if (i !== last + 1 && out.length > 0) {
      out.push("\u2026");
    }
    out.push(line);
    size += line.length + 1;
    last = i;
  }
  return out.join("\n");
}

// src/i18n-dict.ts
function resolveLanguage(setting, locale) {
  if (setting === "en" || setting === "vi" || setting === "zh") return setting;
  const lower = locale.toLowerCase();
  if (lower.startsWith("vi")) return "vi";
  if (lower.startsWith("zh")) return "zh";
  return "en";
}
function translate(lang, text, params) {
  const dict = lang === "vi" ? VI : lang === "zh" ? ZH : {};
  const template = dict[text] ?? text;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => key in params ? String(params[key]) : match);
}
var VI = {
  "Copilot model discovery": "Kh\xE1m ph\xE1 m\xF4 h\xECnh Copilot",
  "Refresh the Copilot model list first, then reopen these logs. This section is included when you copy the logs.": "L\xE0m m\u1EDBi danh s\xE1ch m\xF4 h\xECnh Copilot tr\u01B0\u1EDBc, r\u1ED3i m\u1EDF l\u1EA1i nh\u1EADt k\xFD. Ph\u1EA7n n\xE0y \u0111\u01B0\u1EE3c bao g\u1ED3m khi b\u1EA1n sao ch\xE9p nh\u1EADt k\xFD.",
  "The plugin could not verify the desktop runtime. Open Show Logs and share the Copilot model discovery section.": "Plugin kh\xF4ng th\u1EC3 x\xE1c minh m\xF4i tr\u01B0\u1EDDng ch\u1EA1y c\u1EE7a \u1EE9ng d\u1EE5ng. M\u1EDF Xem nh\u1EADt k\xFD v\xE0 chia s\u1EBB ph\u1EA7n Kh\xE1m ph\xE1 m\xF4 h\xECnh Copilot.",
  "The required desktop SDK could not be loaded. Open Show Logs and share the Copilot model discovery section.": "Kh\xF4ng th\u1EC3 t\u1EA3i SDK c\u1EA7n thi\u1EBFt c\u1EE7a \u1EE9ng d\u1EE5ng. M\u1EDF Xem nh\u1EADt k\xFD v\xE0 chia s\u1EBB ph\u1EA7n Kh\xE1m ph\xE1 m\xF4 h\xECnh Copilot.",
  "Copilot could not return its model list. Try Refresh, then open Show Logs and share the Copilot model discovery section if it still fails.": "Copilot kh\xF4ng th\u1EC3 tr\u1EA3 v\u1EC1 danh s\xE1ch m\xF4 h\xECnh. Th\u1EED L\xE0m m\u1EDBi, r\u1ED3i m\u1EDF Xem nh\u1EADt k\xFD v\xE0 chia s\u1EBB ph\u1EA7n Kh\xE1m ph\xE1 m\xF4 h\xECnh Copilot n\u1EBFu v\u1EABn l\u1ED7i.",
  "No eligible Copilot models were returned for this session. Check your Copilot sign-in and model access, then refresh. Show Logs includes the model discovery results.": "Phi\xEAn n\xE0y kh\xF4ng tr\u1EA3 v\u1EC1 m\xF4 h\xECnh Copilot \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n. Ki\u1EC3m tra \u0111\u0103ng nh\u1EADp Copilot v\xE0 quy\u1EC1n truy c\u1EADp m\xF4 h\xECnh, r\u1ED3i l\xE0m m\u1EDBi. Xem nh\u1EADt k\xFD ch\u1EE9a k\u1EBFt qu\u1EA3 kh\xE1m ph\xE1 m\xF4 h\xECnh.",
  "Show Logs": "Xem nh\u1EADt k\xFD",
  "Diagnostic logs": "Nh\u1EADt k\xFD ch\u1EA9n \u0111o\xE1n",
  "Copy logs": "Sao ch\xE9p nh\u1EADt k\xFD",
  "Collecting logs\u2026": "\u0110ang thu th\u1EADp nh\u1EADt k\xFD\u2026",
  "Reproduce the problem, then open these logs and copy them into your issue. They contain recent operation results and error codes, without prompts, file contents, paths, account names, or API keys. Nothing is uploaded automatically.": "T\xE1i hi\u1EC7n s\u1EF1 c\u1ED1, sau \u0111\xF3 m\u1EDF nh\u1EADt k\xFD n\xE0y v\xE0 sao ch\xE9p v\xE0o b\xE1o c\xE1o l\u1ED7i. Nh\u1EADt k\xFD ch\u1EE9a k\u1EBFt qu\u1EA3 thao t\xE1c v\xE0 m\xE3 l\u1ED7i g\u1EA7n \u0111\xE2y, kh\xF4ng c\xF3 l\u1EDDi nh\u1EAFc, n\u1ED9i dung t\u1EC7p, \u0111\u01B0\u1EDDng d\u1EABn, t\xEAn t\xE0i kho\u1EA3n hay kh\xF3a API. Kh\xF4ng c\xF3 d\u1EEF li\u1EC7u n\xE0o \u0111\u01B0\u1EE3c t\u1EF1 \u0111\u1ED9ng t\u1EA3i l\xEAn.",
  "Up to 200 events per component are kept in memory. Restarting clears them. Reopen this dialog to capture newer events.": "M\u1ED7i th\xE0nh ph\u1EA7n gi\u1EEF t\u1ED1i \u0111a 200 s\u1EF1 ki\u1EC7n trong b\u1ED9 nh\u1EDB. Kh\u1EDFi \u0111\u1ED9ng l\u1EA1i s\u1EBD x\xF3a nh\u1EADt k\xFD. M\u1EDF l\u1EA1i h\u1ED9p tho\u1EA1i \u0111\u1EC3 l\u1EA5y c\xE1c s\u1EF1 ki\u1EC7n m\u1EDBi h\u01A1n.",
  "The worker could not be reached. These logs include panel diagnostics only.": "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i v\u1EDBi ti\u1EBFn tr\xECnh x\u1EED l\xFD. Nh\u1EADt k\xFD n\xE0y ch\u1EC9 ch\u1EE9a ch\u1EA9n \u0111o\xE1n c\u1EE7a b\u1EA3ng \u0111i\u1EC1u khi\u1EC3n.",
  "Clipboard access is unavailable. The logs are selected; copy them with Ctrl+C or Command+C.": "Kh\xF4ng th\u1EC3 truy c\u1EADp b\u1EA3ng nh\u1EDB t\u1EA1m. Nh\u1EADt k\xFD \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1ECDn; h\xE3y sao ch\xE9p b\u1EB1ng Ctrl+C ho\u1EB7c Command+C.",
  "No enabled API model: Copilot helpers and subscription CLIs are excluded from the two-second chat hook.": "Kh\xF4ng c\xF3 m\xF4 h\xECnh API \u0111ang b\u1EADt: phi\xEAn Copilot n\u1EC1n v\xE0 CLI thu\xEA bao kh\xF4ng d\xF9ng \u0111\u01B0\u1EE3c trong hook chat c\xF3 gi\u1EDBi h\u1EA1n hai gi\xE2y.",
  "Refresh API and Copilot model lists and the public Claude Code schema. Copilot rewriting needs this enabled to verify model access.": "L\xE0m m\u1EDBi danh s\xE1ch m\xF4 h\xECnh API, Copilot v\xE0 l\u01B0\u1EE3c \u0111\u1ED3 Claude Code c\xF4ng khai. Vi\u1EBFt l\u1EA1i b\u1EB1ng Copilot c\u1EA7n b\u1EADt m\u1EE5c n\xE0y \u0111\u1EC3 x\xE1c minh quy\u1EC1n truy c\u1EADp m\xF4 h\xECnh.",
  "Model-list requests use the provider account. List refreshes send no prompt or project context.": "Y\xEAu c\u1EA7u danh s\xE1ch m\xF4 h\xECnh d\xF9ng t\xE0i kho\u1EA3n c\u1EE7a nh\xE0 cung c\u1EA5p. L\xE0m m\u1EDBi danh s\xE1ch kh\xF4ng g\u1EEDi prompt hay ng\u1EEF c\u1EA3nh d\u1EF1 \xE1n.",
  "Models available through this Copilot session. Access is checked again before each rewrite.": "C\xE1c m\xF4 h\xECnh c\xF3 s\u1EB5n trong phi\xEAn Copilot n\xE0y. Quy\u1EC1n truy c\u1EADp \u0111\u01B0\u1EE3c ki\u1EC3m tra l\u1EA1i tr\u01B0\u1EDBc m\u1ED7i l\u1EA7n vi\u1EBFt l\u1EA1i.",
  "Refresh to check which Copilot models are available.": "L\xE0m m\u1EDBi \u0111\u1EC3 ki\u1EC3m tra c\xE1c m\xF4 h\xECnh Copilot c\xF3 s\u1EB5n.",
  "Uses your GitHub Copilot account in the background. No npm install, API key or separate runtime. Copilot usage charges apply. It never falls back to another provider and is unavailable for chat auto-enhance.": "D\xF9ng t\xE0i kho\u1EA3n GitHub Copilot c\u1EE7a b\u1EA1n \u1EDF ch\u1EBF \u0111\u1ED9 n\u1EC1n. Kh\xF4ng c\u1EA7n c\xE0i npm, kh\xF3a API hay m\xF4i tr\u01B0\u1EDDng ch\u1EA1y ri\xEAng. C\xF3 t\xEDnh ph\xED s\u1EED d\u1EE5ng Copilot. Kh\xF4ng chuy\u1EC3n sang nh\xE0 cung c\u1EA5p kh\xE1c v\xE0 kh\xF4ng h\u1ED7 tr\u1EE3 t\u1EF1 \u0111\u1ED9ng c\u1EA3i thi\u1EC7n trong chat.",
  "GitHub Copilot \xB7 background rewrite": "GitHub Copilot \xB7 vi\u1EBFt l\u1EA1i \u1EDF ch\u1EBF \u0111\u1ED9 n\u1EC1n",
  "Add GitHub Copilot to rewrite with your Copilot account, or choose an external provider.": "Th\xEAm GitHub Copilot \u0111\u1EC3 vi\u1EBFt l\u1EA1i b\u1EB1ng t\xE0i kho\u1EA3n Copilot c\u1EE7a b\u1EA1n, ho\u1EB7c ch\u1ECDn nh\xE0 cung c\u1EA5p b\xEAn ngo\xE0i.",
  "It needs an enabled API model. Copilot background rewriting and subscription CLIs are excluded from its two-second limit. Add an API model, or use Rules.": "C\u1EA7n m\u1ED9t m\xF4 h\xECnh API \u0111ang b\u1EADt. Vi\u1EBFt l\u1EA1i b\u1EB1ng Copilot \u1EDF ch\u1EBF \u0111\u1ED9 n\u1EC1n v\xE0 CLI thu\xEA bao kh\xF4ng d\xF9ng \u0111\u01B0\u1EE3c trong gi\u1EDBi h\u1EA1n hai gi\xE2y. Th\xEAm m\xF4 h\xECnh API ho\u1EB7c d\xF9ng Quy t\u1EAFc.",
  "Copilot background rewriting is unavailable. Restart or update GitHub Copilot and reopen this plugin. No separate SDK or runtime is installed.": "Kh\xF4ng th\u1EC3 vi\u1EBFt l\u1EA1i b\u1EB1ng Copilot \u1EDF ch\u1EBF \u0111\u1ED9 n\u1EC1n. Kh\u1EDFi \u0111\u1ED9ng l\u1EA1i ho\u1EB7c c\u1EADp nh\u1EADt GitHub Copilot r\u1ED3i m\u1EDF l\u1EA1i plugin. Kh\xF4ng c\xF3 SDK hay m\xF4i tr\u01B0\u1EDDng ch\u1EA1y ri\xEAng n\xE0o \u0111\u01B0\u1EE3c c\xE0i \u0111\u1EB7t.",
  "The background runtime could not verify the same GitHub account as this Copilot session. Check your existing Copilot sign-in. No prompt was sent.": "M\xF4i tr\u01B0\u1EDDng ch\u1EA1y n\u1EC1n kh\xF4ng x\xE1c minh \u0111\u01B0\u1EE3c c\xF9ng t\xE0i kho\u1EA3n GitHub v\u1EDBi phi\xEAn Copilot n\xE0y. Ki\u1EC3m tra t\xE0i kho\u1EA3n Copilot \u0111ang \u0111\u0103ng nh\u1EADp. Ch\u01B0a g\u1EEDi prompt n\xE0o.",
  "This model is not available through GitHub Copilot in both sessions. Refresh the model list and choose a Copilot model.": "M\xF4 h\xECnh n\xE0y kh\xF4ng c\xF3 s\u1EB5n qua GitHub Copilot trong c\u1EA3 hai phi\xEAn. L\xE0m m\u1EDBi danh s\xE1ch r\u1ED3i ch\u1ECDn m\xF4 h\xECnh Copilot.",
  "This Copilot model does not report image support. Choose a model with image support or remove the images.": "M\xF4 h\xECnh Copilot n\xE0y kh\xF4ng x\xE1c nh\u1EADn h\u1ED7 tr\u1EE3 \u1EA3nh. Ch\u1ECDn m\xF4 h\xECnh h\u1ED7 tr\u1EE3 \u1EA3nh ho\u1EB7c b\u1ECF \u1EA3nh \u0111\xEDnh k\xE8m.",
  "GitHub Copilot": "GitHub Copilot",
  "A little more thought. A clearer prompt.": "Th\xEAm ch\xFAt suy ngh\u0129. Prompt r\xF5 r\xE0ng h\u01A1n.",
  "A fresh page for your next idea": "Trang m\u1EDBi cho \xFD t\u01B0\u1EDFng ti\u1EBFp theo",
  "Draft ready to enhance": "B\u1EA3n nh\xE1p \u0111\xE3 s\u1EB5n s\xE0ng \u0111\u1EC3 c\u1EA3i thi\u1EC7n",
  "Enhancing your request\u2026": "\u0110ang c\u1EA3i thi\u1EC7n y\xEAu c\u1EA7u\u2026",
  "Prompt ready to review": "Prompt \u0111\xE3 s\u1EB5n s\xE0ng \u0111\u1EC3 xem l\u1EA1i",
  "Enhancement failed": "C\u1EA3i thi\u1EC7n th\u1EA5t b\u1EA1i",
  "Enhancement cancelled": "\u0110\xE3 h\u1EE7y c\u1EA3i thi\u1EC7n",
  "Switch to light mode": "Chuy\u1EC3n sang giao di\u1EC7n s\xE1ng",
  "Switch to dark mode": "Chuy\u1EC3n sang giao di\u1EC7n t\u1ED1i",
  "Plugin sections": "C\xE1c m\u1EE5c c\u1EE7a plugin",
  "Enhance": "C\u1EA3i thi\u1EC7n",
  "Write a request": "Vi\u1EBFt y\xEAu c\u1EA7u",
  "Review and send": "Xem l\u1EA1i v\xE0 g\u1EEDi",
  "Enter to enhance \xB7 Shift+Enter for a new line": "Enter \u0111\u1EC3 c\u1EA3i thi\u1EC7n \xB7 Shift+Enter \u0111\u1EC3 xu\u1ED1ng d\xF2ng",
  "Enhance and send": "C\u1EA3i thi\u1EC7n v\xE0 g\u1EEDi",
  "Enhance and send skips review. Enhance lets you edit first.": "C\u1EA3i thi\u1EC7n v\xE0 g\u1EEDi s\u1EBD b\u1ECF qua b\u01B0\u1EDBc xem l\u1EA1i. Ch\u1ECDn C\u1EA3i thi\u1EC7n \u0111\u1EC3 ch\u1EC9nh s\u1EEDa tr\u01B0\u1EDBc.",
  "Context to include": "Ng\u1EEF c\u1EA3nh c\u1EA7n g\u1EEDi k\xE8m",
  "Uncheck anything you do not want sent to the rewriting model.": "B\u1ECF ch\u1ECDn nh\u1EEFng m\u1EE5c b\u1EA1n kh\xF4ng mu\u1ED1n g\u1EEDi cho m\xF4 h\xECnh vi\u1EBFt l\u1EA1i.",
  "Edit the enhanced prompt below, then copy it or send it to Copilot.": "Ch\u1EC9nh s\u1EEDa prompt \u0111\xE3 c\u1EA3i thi\u1EC7n b\xEAn d\u01B0\u1EDBi, r\u1ED3i sao ch\xE9p ho\u1EB7c g\u1EEDi t\u1EDBi Copilot.",
  "Copilot session unavailable. You can still copy or save this prompt.": "Phi\xEAn Copilot kh\xF4ng kh\u1EA3 d\u1EE5ng. B\u1EA1n v\u1EABn c\xF3 th\u1EC3 sao ch\xE9p ho\u1EB7c l\u01B0u prompt n\xE0y.",
  "Wait for the current operation to finish before sending.": "Ch\u1EDD thao t\xE1c hi\u1EC7n t\u1EA1i ho\xE0n t\u1EA5t tr\u01B0\u1EDBc khi g\u1EEDi.",
  "Reuse": "D\xF9ng l\u1EA1i",
  "Send to Copilot is off in Settings. You can still copy or save this prompt.": "G\u1EEDi t\u1EDBi Copilot \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t. B\u1EA1n v\u1EABn c\xF3 th\u1EC3 sao ch\xE9p ho\u1EB7c l\u01B0u prompt n\xE0y.",
  "AI file picker skipped: {reason}": "B\u1ECF qua AI ch\u1ECDn file: {reason}",
  "Preview skips the AI file picker.": "Xem tr\u01B0\u1EDBc b\u1ECF qua b\u01B0\u1EDBc AI ch\u1ECDn file.",
  "Project files are off in Settings: workspace and agent only.": "\u0110\u1ECDc file d\u1EF1 \xE1n \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t: ch\u1EC9 d\xF9ng workspace v\xE0 agent.",
  "No files matched the prompt; the agent will be told to locate them.": "Kh\xF4ng file n\xE0o kh\u1EDBp prompt; agent s\u1EBD \u0111\u01B0\u1EE3c d\u1EB7n t\u1EF1 t\xECm.",
  "Not a git repository: no git context.": "Kh\xF4ng ph\u1EA3i repo git: kh\xF4ng c\xF3 ng\u1EEF c\u1EA3nh git.",
  "Terminal output is off in Settings.": "\u0110\u1ECDc output terminal \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t.",
  "Remote (SSH/WSL) workspace: project files are not readable from the plugin.": "Workspace t\u1EEB xa (SSH/WSL): plugin kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c file d\u1EF1 \xE1n.",
  "Could not tell which folder the workspace is in; project files skipped.": "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c th\u01B0 m\u1EE5c c\u1EE7a workspace; b\u1ECF qua file d\u1EF1 \xE1n.",
  "No focused workspace.": "Ch\u01B0a m\u1EDF workspace n\xE0o.",
  "trimmed": "\u0111\xE3 c\u1EAFt b\u1EDBt",
  "picked by AI": "AI ch\u1ECDn",
  "keyword match": "kh\u1EDBp t\u1EEB kho\xE1",
  "terminal": "terminal",
  "file": "file",
  "git": "git",
  "tree": "c\xE2y th\u01B0 m\u1EE5c",
  "stack": "stack",
  "rules": "lu\u1EADt",
  "agent": "agent",
  "workspace": "workspace",
  "Recent output: {name}": "Output g\u1EA7n \u0111\xE2y: {name}",
  "Git status ({count} changed)": "Git status ({count} thay \u0111\u1ED5i)",
  "Repository tree ({count} files)": "C\xE2y th\u01B0 m\u1EE5c ({count} file)",
  "Uncommitted changes": "Thay \u0111\u1ED5i ch\u01B0a commit",
  "Recent commits": "Commit g\u1EA7n \u0111\xE2y",
  "Stack & commands": "Stack v\xE0 l\u1EC7nh",
  "Target agent": "Agent \u0111\xEDch",
  "Workspace": "Workspace",
  "Writing the prompt": "Vi\u1EBFt prompt",
  "Reading terminal output": "\u0110\u1ECDc output terminal",
  "AI picking files": "AI ch\u1ECDn file",
  "Finding relevant code": "T\xECm code li\xEAn quan",
  "Reading git changes": "\u0110\u1ECDc thay \u0111\u1ED5i git",
  "Reading project rules and stack": "\u0110\u1ECDc lu\u1EADt v\xE0 stack c\u1EE7a d\u1EF1 \xE1n",
  "Reading workspace": "\u0110\u1ECDc workspace",
  "Panel language": "Ng\xF4n ng\u1EEF giao di\u1EC7n",
  "Done": "Xong",
  "Try again": "Th\u1EED l\u1EA1i",
  "Enhance failed": "C\u1EA3i thi\u1EC7n th\u1EA5t b\u1EA1i",
  "Cancelled": "\u0110\xE3 hu\u1EF7",
  "Starting\u2026": "\u0110ang b\u1EAFt \u0111\u1EA7u\u2026",
  "{count} files": "{count} file",
  "{count} changed": "{count} thay \u0111\u1ED5i",
  "{count} lines": "{count} d\xF2ng",
  "latest": "m\u1EDBi nh\u1EA5t",
  "Models": "Model",
  "Settings": "C\xE0i \u0111\u1EB7t",
  "That terminal is no longer open.": "Terminal \u0111\xF3 kh\xF4ng c\xF2n m\u1EDF n\u1EEFa.",
  "Typed into {label}, without Enter.": "\u0110\xE3 g\xF5 v\xE0o {label}, kh\xF4ng nh\u1EA5n Enter.",
  "Type it without Enter": "G\xF5 v\xE0o, kh\xF4ng nh\u1EA5n Enter",
  "Back in the history.": "\u0110\xE3 \u0111\u01B0a l\u1EA1i v\xE0o l\u1ECBch s\u1EED.",
  "It could not be brought back.": "Kh\xF4ng \u0111\u01B0a l\u1EA1i \u0111\u01B0\u1EE3c.",
  "This prompt was written in {name}: read it before you send it here.": "Prompt n\xE0y \u0111\u01B0\u1EE3c vi\u1EBFt \u1EDF {name}: h\xE3y \u0111\u1ECDc l\u1EA1i tr\u01B0\u1EDBc khi g\u1EEDi \u1EDF \u0111\xE2y.",
  "Something is still running here. Try again when it has finished.": "\u1EDE \u0111\xE2y c\xF2n vi\u1EC7c \u0111ang ch\u1EA1y. H\xE3y th\u1EED l\u1EA1i khi n\xF3 xong.",
  "Opened from the history. What the composer held was replaced.": "\u0110\xE3 m\u1EDF t\u1EEB l\u1ECBch s\u1EED. N\u1ED9i dung \u0111ang so\u1EA1n \u0111\xE3 b\u1ECB thay th\u1EBF.",
  "Undo": "Ho\xE0n t\xE1c",
  "Removed from the history.": "\u0110\xE3 x\xF3a kh\u1ECFi l\u1ECBch s\u1EED.",
  "Auto-enhance left a prompt for {agent} unchanged: {reason}": "T\u1EF1 c\u1EA3i thi\u1EC7n \u0111\u1EC3 nguy\xEAn m\u1ED9t prompt g\u1EEDi cho {agent}: {reason}",
  "Found on this machine. It uses your subscription: no API key needed.": "T\xECm th\u1EA5y tr\xEAn m\xE1y n\xE0y. N\xF3 d\xF9ng g\xF3i \u0111\u0103ng k\xFD c\u1EE7a b\u1EA1n: kh\xF4ng c\u1EA7n API key.",
  "Use {name}": "D\xF9ng {name}",
  "Other models": "Model kh\xE1c",
  "Which prompts to show": "Hi\u1EC7n prompt n\xE0o",
  "Nothing here matches.": "Kh\xF4ng c\xF3 m\u1EE5c n\xE0o kh\u1EDBp.",
  "Hide the enhanced prompt": "\u1EA8n prompt \u0111\xE3 c\u1EA3i thi\u1EC7n",
  "Show the enhanced prompt": "Xem prompt \u0111\xE3 c\u1EA3i thi\u1EC7n",
  "API keys cannot be saved on this machine": "M\xE1y n\xE0y kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c API key",
  "Copilot found no key store here to keep them in. Use a key from an environment variable (the switch for it is in Settings), or a subscription CLI.": "Copilot kh\xF4ng t\xECm th\u1EA5y kho kh\xF3a n\xE0o tr\xEAn m\xE1y n\xE0y \u0111\u1EC3 c\u1EA5t ch\xFAng. H\xE3y d\xF9ng key t\u1EEB bi\u1EBFn m\xF4i tr\u01B0\u1EDDng (c\xF4ng t\u1EAFc n\u1EB1m trong C\xE0i \u0111\u1EB7t), ho\u1EB7c m\u1ED9t CLI \u0111\u0103ng k\xFD.",
  "What this switch does, what can go wrong, and when it is worth turning on.": "C\xF4ng t\u1EAFc n\xE0y l\xE0m g\xEC, \u0111i\u1EC1u g\xEC c\xF3 th\u1EC3 x\u1EA3y ra, v\xE0 khi n\xE0o \u0111\xE1ng b\u1EADt.",
  "What it does": "N\xF3 l\xE0m g\xEC",
  "What can go wrong": "R\u1EE7i ro",
  "When to turn it on": "Khi n\xE0o n\xEAn b\u1EADt",
  "Last prompt ({when}): rewritten for {agent} with {model}.": "Prompt g\u1EA7n nh\u1EA5t ({when}): \u0111\xE3 vi\u1EBFt l\u1EA1i cho {agent} b\u1EB1ng {model}.",
  "Last prompt ({when}): your text was added for {agent}.": "Prompt g\u1EA7n nh\u1EA5t ({when}): \u0111\xE3 th\xEAm \u0111o\u1EA1n v\u0103n c\u1EE7a b\u1EA1n cho {agent}.",
  "Last prompt ({when}): left unchanged for {agent}. {reason}": "Prompt g\u1EA7n nh\u1EA5t ({when}): \u0111\u1EC3 nguy\xEAn cho {agent}. {reason}",
  "Risk and when to use it": "R\u1EE7i ro v\xE0 khi n\xE0o n\xEAn d\xF9ng",
  "File and folder names, your agent rules, the README and manifest files go to the model you run. Files that look like secrets (.env, keys, certificates) are never read.": "T\xEAn file v\xE0 th\u01B0 m\u1EE5c, c\xE1c quy t\u1EAFc cho agent, README v\xE0 c\xE1c file manifest \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi model b\u1EA1n ch\u1EA1y. Nh\u1EEFng file tr\xF4ng nh\u01B0 b\xED m\u1EADt (.env, kh\xF3a, ch\u1EE9ng ch\u1EC9) kh\xF4ng bao gi\u1EDD \u0111\u01B0\u1EE3c \u0111\u1ECDc.",
  "Keep it on for prompts that name real files and commands. Turn it off in a project whose contents must not reach a model provider.": "N\xEAn b\u1EADt \u0111\u1EC3 prompt n\xEAu \u0111\xFAng file v\xE0 l\u1EC7nh th\u1EADt. T\u1EAFt \u1EDF d\u1EF1 \xE1n c\xF3 n\u1ED9i dung kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p t\u1EDBi nh\xE0 cung c\u1EA5p model.",
  "Branch names, commit subjects, the list of changed files and the diff of your uncommitted changes go to the model. Nothing in the repository is changed.": "T\xEAn nh\xE1nh, ti\xEAu \u0111\u1EC1 commit, danh s\xE1ch file \u0111\xE3 \u0111\u1ED5i v\xE0 diff c\xE1c thay \u0111\u1ED5i ch\u01B0a commit \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi model. Kh\xF4ng c\xF3 g\xEC trong repository b\u1ECB thay \u0111\u1ED5i.",
  "On when a prompt should know what you are working on right now. Off when uncommitted changes may hold something you would not share.": "B\u1EADt khi prompt c\u1EA7n bi\u1EBFt b\u1EA1n \u0111ang l\xE0m d\u1EDF vi\u1EC7c g\xEC. T\u1EAFt khi c\xE1c thay \u0111\u1ED5i ch\u01B0a commit c\xF3 th\u1EC3 ch\u1EE9a th\u1EE9 b\u1EA1n kh\xF4ng mu\u1ED1n chia s\u1EBB.",
  "A terminal shows whatever was printed: paths, logs, data. Values that look like keys, tokens or passwords are masked first, which cannot catch everything.": "Terminal hi\u1EC7n m\u1ECDi th\u1EE9 \u0111\xE3 in ra: \u0111\u01B0\u1EDDng d\u1EABn, log, d\u1EEF li\u1EC7u. Nh\u1EEFng gi\xE1 tr\u1ECB tr\xF4ng nh\u01B0 kh\xF3a, token hay m\u1EADt kh\u1EA9u \u0111\u01B0\u1EE3c che tr\u01B0\u1EDBc, nh\u01B0ng kh\xF4ng th\u1EC3 che h\u1EBFt m\u1ECDi th\u1EE9.",
  "On to fix an error that is on screen in the terminal. Off when your terminals show secrets or customer data.": "B\u1EADt \u0111\u1EC3 s\u1EEDa m\u1ED9t l\u1ED7i \u0111ang hi\u1EC7n trong terminal. T\u1EAFt khi terminal c\u1EE7a b\u1EA1n hi\u1EC7n b\xED m\u1EADt ho\u1EB7c d\u1EEF li\u1EC7u kh\xE1ch h\xE0ng.",
  "Terminals you did not pick are read too, and their text goes to the model: code, file contents and command output of other work.": "C\u1EA3 nh\u1EEFng terminal b\u1EA1n kh\xF4ng ch\u1ECDn c\u0169ng \u0111\u01B0\u1EE3c \u0111\u1ECDc, v\xE0 n\u1ED9i dung c\u1EE7a ch\xFAng \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi model: code, n\u1ED9i dung file v\xE0 output l\u1EC7nh c\u1EE7a c\xF4ng vi\u1EC7c kh\xE1c.",
  "On when several agents share a task and a new prompt must not repeat or undo their work. Otherwise leave it off.": "B\u1EADt khi nhi\u1EC1u agent c\xF9ng l\xE0m m\u1ED9t vi\u1EC7c v\xE0 prompt m\u1EDBi kh\xF4ng \u0111\u01B0\u1EE3c l\u1EB7p l\u1EA1i hay ph\xE1 ph\u1EA7n vi\u1EC7c c\u1EE7a ch\xFAng. C\xF2n l\u1EA1i n\xEAn \u0111\u1EC3 t\u1EAFt.",
  "Tool names, file paths and command lines of every agent in Copilot are kept in memory and sent with Deep and Max prompts. A command line can carry more than you expect.": "T\xEAn c\xF4ng c\u1EE5, \u0111\u01B0\u1EDDng d\u1EABn file v\xE0 d\xF2ng l\u1EC7nh c\u1EE7a m\u1ECDi agent trong Copilot \u0111\u01B0\u1EE3c gi\u1EEF trong b\u1ED9 nh\u1EDB v\xE0 g\u1EEDi k\xE8m prompt \u1EDF m\u1EE9c S\xE2u v\xE0 T\u1ED1i \u0111a. M\u1ED9t d\xF2ng l\u1EC7nh c\xF3 th\u1EC3 ch\u1EE9a nhi\u1EC1u th\u1EE9 h\u01A1n b\u1EA1n ngh\u0129.",
  "On when prompts should follow on from what the agents just did. Off when command lines may hold secrets.": "B\u1EADt khi prompt c\u1EA7n n\u1ED1i ti\u1EBFp vi\u1EC7c c\xE1c agent v\u1EEBa l\xE0m. T\u1EAFt khi d\xF2ng l\u1EC7nh c\xF3 th\u1EC3 ch\u1EE9a b\xED m\u1EADt.",
  "Only paths are noted, never the text of a file. A path can still say what you are working on.": "Ch\u1EC9 ghi nh\u1EADn \u0111\u01B0\u1EDDng d\u1EABn, kh\xF4ng bao gi\u1EDD ghi n\u1ED9i dung file. D\xF9 v\u1EADy m\u1ED9t \u0111\u01B0\u1EDDng d\u1EABn v\u1EABn c\xF3 th\u1EC3 cho bi\u1EBFt b\u1EA1n \u0111ang l\xE0m g\xEC.",
  "On when you edit in Copilot and want those files found first. It changes nothing if you edit elsewhere.": "B\u1EADt khi b\u1EA1n s\u1EEDa file trong Copilot v\xE0 mu\u1ED1n nh\u1EEFng file \u0111\xF3 \u0111\u01B0\u1EE3c t\xECm th\u1EA5y tr\u01B0\u1EDBc. N\u1EBFu b\u1EA1n s\u1EEDa \u1EDF n\u01A1i kh\xE1c th\xEC n\xF3 kh\xF4ng \u0111\u1ED5i g\xEC.",
  "On for the normal flow. Off to be sure nothing is ever typed for you: Copy still works.": "B\u1EADt cho c\xE1ch d\xF9ng th\xF4ng th\u01B0\u1EDDng. T\u1EAFt \u0111\u1EC3 ch\u1EAFc ch\u1EAFn kh\xF4ng c\xF3 g\xEC \u0111\u01B0\u1EE3c g\xF5 thay b\u1EA1n: Sao ch\xE9p v\u1EABn d\xF9ng \u0111\u01B0\u1EE3c.",
  "A new agent runs with your user account and its own permission settings: it can change files and run commands.": "Agent m\u1EDBi ch\u1EA1y b\u1EB1ng t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng c\u1EE7a b\u1EA1n v\xE0 theo thi\u1EBFt l\u1EADp quy\u1EC1n c\u1EE7a ch\xEDnh n\xF3: n\xF3 c\xF3 th\u1EC3 s\u1EEDa file v\xE0 ch\u1EA1y l\u1EC7nh.",
  "On when you often start a fresh agent for each task. It only happens when you press Start.": "B\u1EADt khi b\u1EA1n hay m\u1EDF m\u1ED9t agent m\u1EDBi cho t\u1EEBng vi\u1EC7c. Ch\u1EC9 x\u1EA3y ra khi b\u1EA1n b\u1EA5m M\u1EDF.",
  "An editor tab opens in Copilot's window. Nothing is read or changed by it.": "M\u1ED9t tab so\u1EA1n th\u1EA3o \u0111\u01B0\u1EE3c m\u1EDF trong c\u1EEDa s\u1ED5 Copilot. Vi\u1EC7c n\xE0y kh\xF4ng \u0111\u1ECDc hay thay \u0111\u1ED5i g\xEC.",
  "On to look at what was read before you send. Off if the panel should never change what Copilot shows.": "B\u1EADt \u0111\u1EC3 xem l\u1EA1i nh\u1EEFng g\xEC \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1ECDc tr\u01B0\u1EDBc khi g\u1EEDi. T\u1EAFt n\u1EBFu b\u1EA1n kh\xF4ng mu\u1ED1n panel thay \u0111\u1ED5i nh\u1EEFng g\xEC Copilot \u0111ang hi\u1EC7n.",
  "On to reuse earlier prompts and to find your draft again after a restart. Off on a shared machine, or when prompts hold things that must not be kept.": "B\u1EADt \u0111\u1EC3 d\xF9ng l\u1EA1i prompt c\u0169 v\xE0 t\xECm l\u1EA1i b\u1EA3n nh\xE1p sau khi kh\u1EDFi \u0111\u1ED9ng l\u1EA1i. T\u1EAFt tr\xEAn m\xE1y d\xF9ng chung, ho\u1EB7c khi prompt ch\u1EE9a th\u1EE9 kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p l\u01B0u.",
  "A key from your environment is sent to that provider like a saved one, and its account pays for the calls.": "Key l\u1EA5y t\u1EEB m\xF4i tr\u01B0\u1EDDng \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi nh\xE0 cung c\u1EA5p \u0111\xF3 nh\u01B0 m\u1ED9t key \u0111\xE3 l\u01B0u, v\xE0 t\xE0i kho\u1EA3n c\u1EE7a key \u0111\xF3 tr\u1EA3 ti\u1EC1n cho c\xE1c l\u1EA7n g\u1ECDi.",
  "On when your keys already live in the environment and you do not want to store them twice. Off to use only the keys you saved in Models.": "B\u1EADt khi key c\u1EE7a b\u1EA1n \u0111\xE3 c\xF3 s\u1EB5n trong m\xF4i tr\u01B0\u1EDDng v\xE0 b\u1EA1n kh\xF4ng mu\u1ED1n l\u01B0u hai n\u01A1i. T\u1EAFt \u0111\u1EC3 ch\u1EC9 d\xF9ng nh\u1EEFng key b\u1EA1n \u0111\xE3 l\u01B0u trong Model.",
  "On to see new models without updating the plugin. Off for no network traffic besides the model calls.": "B\u1EADt \u0111\u1EC3 th\u1EA5y model m\u1EDBi m\xE0 kh\xF4ng c\u1EA7n c\u1EADp nh\u1EADt plugin. T\u1EAFt n\u1EBFu kh\xF4ng mu\u1ED1n c\xF3 l\u01B0u l\u01B0\u1EE3ng m\u1EA1ng n\xE0o ngo\xE0i c\xE1c l\u1EA7n g\u1ECDi model.",
  "What it may read": "Plugin \u0111\u01B0\u1EE3c \u0111\u1ECDc g\xEC",
  "What it may do": "Plugin \u0111\u01B0\u1EE3c l\xE0m g\xEC",
  "What it may keep and fetch": "Plugin \u0111\u01B0\u1EE3c l\u01B0u v\xE0 t\u1EA3i g\xEC",
  "working": "\u0111ang l\xE0m",
  "needs you": "c\u1EA7n b\u1EA1n",
  "waiting": "\u0111ang ch\u1EDD",
  "done": "xong",
  "Read project files": "\u0110\u1ECDc file d\u1EF1 \xE1n",
  "Run git": "Ch\u1EA1y git",
  "Read terminal output": "\u0110\u1ECDc output terminal",
  "Save history": "L\u01B0u l\u1ECBch s\u1EED",
  "Use API keys from environment variables": "D\xF9ng API key t\u1EEB bi\u1EBFn m\xF4i tr\u01B0\u1EDDng",
  "Fetch model lists online": "T\u1EA3i danh s\xE1ch model qua m\u1EA1ng",
  "Agent rules, README, manifest files and the file list of the focused workspace (Standard level and above). Off: only workspace and agent names are used.": "Lu\u1EADt agent, README, file manifest v\xE0 danh s\xE1ch file c\u1EE7a workspace \u0111ang m\u1EDF (m\u1EE9c Chu\u1EA9n tr\u1EDF l\xEAn). T\u1EAFt: ch\u1EC9 d\xF9ng t\xEAn workspace v\xE0 agent.",
  "Read-only git status, log, diff, ls-files and grep in the focused workspace (Deep and Max levels).": "Ch\u1EC9 \u0111\u1ECDc: git status, log, diff, ls-files v\xE0 grep trong workspace \u0111ang m\u1EDF (m\u1EE9c S\xE2u v\xE0 T\u1ED1i \u0111a).",
  "The last lines of the terminal you picked, at the Max level only.": "C\xE1c d\xF2ng cu\u1ED1i c\u1EE7a terminal b\u1EA1n ch\u1ECDn, ch\u1EC9 \u1EDF m\u1EE9c T\u1ED1i \u0111a.",
  "Keep your prompts and enhanced prompts in the History tab, on this machine only.": "L\u01B0u prompt g\u1ED1c v\xE0 prompt \u0111\xE3 c\u1EA3i thi\u1EC7n trong tab L\u1ECBch s\u1EED, ch\u1EC9 tr\xEAn m\xE1y n\xE0y.",
  "OPENAI_API_KEY, ANTHROPIC_API_KEY and the others, when a model has no saved key.": "OPENAI_API_KEY, ANTHROPIC_API_KEY v\xE0 c\xE1c bi\u1EBFn kh\xE1c, khi model ch\u01B0a c\xF3 key \u0111\xE3 l\u01B0u.",
  "Stored on this machine": "L\u01B0u tr\xEAn m\xE1y n\xE0y",
  "Nothing is sent anywhere except your prompt and the context you allow, to the model you run. No tracking or analytics.": "Kh\xF4ng g\u1EEDi g\xEC \u0111i \u0111\xE2u ngo\xE0i prompt v\xE0 ng\u1EEF c\u1EA3nh b\u1EA1n cho ph\xE9p, t\u1EDBi model b\u1EA1n ch\u1EA1y. Kh\xF4ng theo d\xF5i, kh\xF4ng analytics.",
  "History": "L\u1ECBch s\u1EED",
  "Saved models": "Model \u0111\xE3 l\u01B0u",
  "Cached model lists": "Danh s\xE1ch model \u0111\xE3 cache",
  "Clear model lists": "Xo\xE1 danh s\xE1ch model",
  "Delete everything": "Xo\xE1 to\xE0n b\u1ED9",
  "Press again to delete everything": "B\u1EA5m l\u1EA7n n\u1EEFa \u0111\u1EC3 xo\xE1 to\xE0n b\u1ED9",
  "All plugin data deleted.": "\u0110\xE3 xo\xE1 to\xE0n b\u1ED9 d\u1EEF li\u1EC7u c\u1EE7a plugin.",
  "History cleared.": "\u0110\xE3 xo\xE1 l\u1ECBch s\u1EED.",
  "Model lists cleared.": "\u0110\xE3 xo\xE1 danh s\xE1ch model.",
  "Auto (fallback)": "T\u1EF1 \u0111\u1ED9ng (d\u1EF1 ph\xF2ng)",
  "Options": "Tu\u1EF3 ch\u1ECDn",
  "Refine: use the enhanced prompt as the new input": "Tinh ch\u1EC9nh ti\u1EBFp: d\xF9ng prompt \u0111\xE3 c\u1EA3i thi\u1EC7n l\xE0m \u0111\u1EA7u v\xE0o m\u1EDBi",
  "Add one in the Models tab.": "Th\xEAm trong tab Model.",
  "Enable": "B\u1EADt",
  "Disable": "T\u1EAFt",
  "Uses your subscription": "D\xF9ng g\xF3i subscription c\u1EE7a b\u1EA1n",
  "default": "m\u1EB7c \u0111\u1ECBnh",
  "Describe what you want the agent to do\u2026": "M\xF4 t\u1EA3 vi\u1EC7c b\u1EA1n mu\u1ED1n agent l\xE0m\u2026",
  "Auto": "T\u1EF1 \u0111\u1ED9ng",
  "Your models": "Model c\u1EE7a b\u1EA1n",
  "Fallback": "D\u1EF1 ph\xF2ng",
  "Auto-enhance": "T\u1EF1 c\u1EA3i thi\u1EC7n",
  "Max context level": "M\u1EE9c ng\u1EEF c\u1EA3nh T\u1ED1i \u0111a",
  "your default": "m\u1EB7c \u0111\u1ECBnh c\u1EE7a b\u1EA1n",
  "Choose a model": "Ch\u1ECDn model",
  "Other (type the id)\u2026": "Kh\xE1c (t\u1EF1 g\xF5 id)\u2026",
  "Refresh model list": "L\xE0m m\u1EDBi danh s\xE1ch model",
  "Model id": "Id model",
  "Loading the model list\u2026": "\u0110ang t\u1EA3i danh s\xE1ch model\u2026",
  "Could not load the list ({error}). Type the model id.": "Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c danh s\xE1ch ({error}). H\xE3y g\xF5 id model.",
  "{count} models from {source}, refreshed daily.": "{count} model t\u1EEB {source}, t\u1EF1 l\xE0m m\u1EDBi m\u1ED7i ng\xE0y.",
  "Uses the model set in the CLI itself.": "D\xF9ng model \u0111ang \u0111\u1EB7t trong ch\xEDnh CLI.",
  "Add the API key to list the models.": "Nh\u1EADp API key \u0111\u1EC3 hi\u1EC7n danh s\xE1ch model.",
  "{name} now uses {model}.": "{name} gi\u1EDD d\xF9ng {model}.",
  "Off": "T\u1EAFt",
  "Your prompt": "Prompt c\u1EE7a b\u1EA1n",
  "Style": "Ki\u1EC3u",
  "Context": "Ng\u1EEF c\u1EA3nh",
  "Model": "Model",
  "Output language": "Ng\xF4n ng\u1EEF \u0111\u1EA7u ra",
  "Output: same as prompt": "\u0110\u1EA7u ra: nh\u01B0 prompt",
  "Output: English": "\u0110\u1EA7u ra: English",
  "Output: Vietnamese": "\u0110\u1EA7u ra: Ti\u1EBFng Vi\u1EC7t",
  "Output: Chinese": "\u0110\u1EA7u ra: \u4E2D\u6587",
  "Output: default ({value})": "\u0110\u1EA7u ra: m\u1EB7c \u0111\u1ECBnh ({value})",
  "Cancel": "Hu\u1EF7",
  "Gathering\u2026": "\u0110ang thu th\u1EADp\u2026",
  "Send to": "G\u1EEDi t\u1EDBi",
  "Enhanced prompt": "Prompt \u0111\xE3 c\u1EA3i thi\u1EC7n",
  "Copy": "Sao ch\xE9p",
  "Clear": "Xo\xE1",
  "No model yet": "Ch\u01B0a c\xF3 model",
  "No API key yet": "Ch\u01B0a c\xF3 API key",
  "Open Models": "M\u1EDF tab Model",
  "{kind} \xB7 {chars} chars": "{kind} \xB7 {chars} k\xFD t\u1EF1",
  "Fell back after: {list}": "\u0110\xE3 chuy\u1EC3n model sau khi l\u1ED7i: {list}",
  "Cancelled.": "\u0110\xE3 hu\u1EF7.",
  "Sent to {label}.": "\u0110\xE3 g\u1EEDi t\u1EDBi {label}.",
  "{label} did not accept the text.": "{label} kh\xF4ng nh\u1EADn n\u1ED9i dung.",
  "Copied to clipboard.": "\u0110\xE3 sao ch\xE9p.",
  "Copy failed: {error}": "Sao ch\xE9p l\u1ED7i: {error}",
  "Saved {name}.": "\u0110\xE3 l\u01B0u {name}.",
  "Added {name}. Use Test to check it is signed in.": "\u0110\xE3 th\xEAm {name}. B\u1EA5m Ki\u1EC3m tra \u0111\u1EC3 ch\u1EAFc n\xF3 \u0111\xE3 \u0111\u0103ng nh\u1EADp.",
  "Auto-enhanced ({mode}) a prompt for {agent}.": "\u0110\xE3 t\u1EF1 c\u1EA3i thi\u1EC7n ({mode}) m\u1ED9t prompt cho {agent}.",
  "an agent": "m\u1ED9t agent",
  "Dismiss": "\u0110\xF3ng",
  "Close": "\u0110\xF3ng",
  "Loading": "\u0110ang t\u1EA3i",
  "No history yet": "Ch\u01B0a c\xF3 l\u1ECBch s\u1EED",
  "Enhanced prompts show up here.": "C\xE1c prompt \u0111\xE3 c\u1EA3i thi\u1EC7n s\u1EBD hi\u1EC7n \u1EDF \u0111\xE2y.",
  "Search history": "T\xECm trong l\u1ECBch s\u1EED",
  "Open in Enhance tab": "M\u1EDF trong tab C\u1EA3i thi\u1EC7n",
  "Delete": "Xo\xE1",
  "{shown} of {total}": "{shown} / {total}",
  "Clear history": "Xo\xE1 l\u1ECBch s\u1EED",
  "auto": "t\u1EF1 \u0111\u1ED9ng",
  "Fallback to the next model when one fails": "Chuy\u1EC3n sang model k\u1EBF ti\u1EBFp khi m\u1ED9t model l\u1ED7i",
  "Models are tried top to bottom. Disabled models are skipped.": "Model \u0111\u01B0\u1EE3c th\u1EED t\u1EEB tr\xEAn xu\u1ED1ng. Model t\u1EAFt s\u1EBD b\u1ECB b\u1ECF qua.",
  "Using API keys from your environment": "\u0110ang d\xF9ng API key t\u1EEB bi\u1EBFn m\xF4i tr\u01B0\u1EDDng",
  "Add a model below to customize; then only your saved models are used.": "Th\xEAm model b\xEAn d\u01B0\u1EDBi \u0111\u1EC3 tu\u1EF3 ch\u1EC9nh; khi \u0111\xF3 ch\u1EC9 d\xF9ng c\xE1c model b\u1EA1n \u0111\xE3 l\u01B0u.",
  "No models yet": "Ch\u01B0a c\xF3 model n\xE0o",
  "Use your subscription, no API key": "D\xF9ng g\xF3i subscription, kh\xF4ng c\u1EA7n API key",
  "Found on this machine. Uses the account the CLI is signed in with.": "T\xECm th\u1EA5y tr\xEAn m\xE1y. D\xF9ng t\xE0i kho\u1EA3n m\xE0 CLI \u0111ang \u0111\u0103ng nh\u1EADp.",
  "Add model": "Th\xEAm model",
  "Add a model": "Th\xEAm model",
  "Edit {name}": "S\u1EEDa {name}",
  "Preset": "M\u1EABu",
  "Name": "T\xEAn",
  "API format": "\u0110\u1ECBnh d\u1EA1ng API",
  "Base URL": "Base URL",
  "Model (optional)": "Model (tu\u1EF3 ch\u1ECDn)",
  "API key": "API key",
  "Leave empty to keep the saved key": "\u0110\u1EC3 tr\u1ED1ng \u0111\u1EC3 gi\u1EEF key \u0111\xE3 l\u01B0u",
  "Or set {env}": "Ho\u1EB7c \u0111\u1EB7t bi\u1EBFn {env}",
  "Not needed for local servers": "Kh\xF4ng c\u1EA7n cho server local",
  "Command": "L\u1EC7nh",
  "Arguments": "Tham s\u1ED1",
  "Found on PATH automatically; or a full path": "T\u1EF1 t\xECm tr\xEAn PATH; ho\u1EB7c \u0111\u01B0\u1EDDng d\u1EABn \u0111\u1EA7y \u0111\u1EE7",
  "CLI default": "M\u1EB7c \u0111\u1ECBnh c\u1EE7a CLI",
  "Runs the CLI already signed in on this machine, so it uses your subscription instead of an API key. Slower than an API (a few seconds per call), so it is skipped by auto-enhance.": "Ch\u1EA1y CLI \u0111\xE3 \u0111\u0103ng nh\u1EADp tr\xEAn m\xE1y n\xE0y, n\xEAn d\xF9ng g\xF3i subscription thay cho API key. Ch\u1EADm h\u01A1n API (v\xE0i gi\xE2y m\u1ED7i l\u1EA7n) n\xEAn auto-enhance s\u1EBD b\u1ECF qua.",
  "Max tokens": "S\u1ED1 token t\u1ED1i \u0111a",
  "{value} tokens": "{value} token",
  "Save": "L\u01B0u",
  "Test": "Ki\u1EC3m tra",
  "Edit": "S\u1EEDa",
  "key saved": "\u0111\xE3 l\u01B0u key",
  "key from env": "key t\u1EEB env",
  "no key": "ch\u01B0a c\xF3 key",
  "local": "local",
  "subscription": "subscription",
  "Same as the chain": "Gi\u1ED1ng chu\u1ED7i model",
  "Auto-enhance hook model (needs to answer in under 2 s)": "Model cho auto-enhance (ph\u1EA3i tr\u1EA3 l\u1EDDi d\u01B0\u1EDBi 2 gi\xE2y)",
  "File picker model (Max context level)": "Model ch\u1ECDn file (m\u1EE9c ng\u1EEF c\u1EA3nh Max)",
  "Balanced": "C\xE2n b\u1EB1ng",
  "Concise": "Ng\u1EAFn g\u1ECDn",
  "Detailed spec": "\u0110\u1EB7c t\u1EA3 chi ti\u1EBFt",
  "Bug fix": "S\u1EEDa l\u1ED7i",
  "New feature": "T\xEDnh n\u0103ng m\u1EDBi",
  "Refactor": "Refactor",
  "Code review": "Review code",
  "Plan first": "L\u1EADp k\u1EBF ho\u1EA1ch tr\u01B0\u1EDBc",
  "Custom only": "Ch\u1EC9 d\xF9ng h\u01B0\u1EDBng d\u1EABn ri\xEAng",
  "Off: prompt only": "T\u1EAFt: ch\u1EC9 prompt",
  "Basic: workspace + agent": "C\u01A1 b\u1EA3n: workspace + agent",
  "Standard: + rules, stack, tree": "Chu\u1EA9n: + lu\u1EADt, stack, c\xE2y th\u01B0 m\u1EE5c",
  "Deep: + git + relevant code": "S\xE2u: + git + code li\xEAn quan",
  "Max: + AI-picked files + terminal": "T\u1ED1i \u0111a: + file AI ch\u1ECDn + terminal",
  "Show more": "Xem th\xEAm",
  "Press again to clear history": "B\u1EA5m l\u1EA7n n\u1EEFa \u0111\u1EC3 xo\xE1 l\u1ECBch s\u1EED",
  "Auto-enhance (AI) has no model to use": "T\u1EF1 c\u1EA3i thi\u1EC7n (AI) kh\xF4ng c\xF3 model \u0111\u1EC3 d\xF9ng",
  "Write a prompt first.": "H\xE3y vi\u1EBFt prompt tr\u01B0\u1EDBc.",
  "Nothing to send.": "Kh\xF4ng c\xF3 g\xEC \u0111\u1EC3 g\u1EEDi.",
  "Invalid model profile.": "C\u1EA5u h\xECnh model kh\xF4ng h\u1EE3p l\u1EC7.",
  "Unknown profile.": "Kh\xF4ng t\xECm th\u1EA5y model n\xE0y.",
  "{name} \xB7 {model} answered (key: {key}).": "{name} \xB7 {model} \u0111\xE3 tr\u1EA3 l\u1EDDi (key: {key}).",
  "Invalid API base URL: {url}": "Base URL c\u1EE7a API kh\xF4ng h\u1EE3p l\u1EC7: {url}",
  "The API base URL must use https (http is allowed only for localhost).": "Base URL c\u1EE7a API ph\u1EA3i d\xF9ng https (ch\u1EC9 localhost \u0111\u01B0\u1EE3c d\xF9ng http).",
  "Put the API key in the Models tab, not in the URL.": "H\xE3y nh\u1EADp API key trong tab Model, \u0111\u1EEBng \u0111\u1EB7t trong URL.",
  "The request was cancelled or timed out.": "Y\xEAu c\u1EA7u \u0111\xE3 b\u1ECB hu\u1EF7 ho\u1EB7c h\u1EBFt th\u1EDDi gian ch\u1EDD.",
  "{model} did not answer within {seconds} s.": "{model} kh\xF4ng tr\u1EA3 l\u1EDDi trong {seconds} gi\xE2y.",
  "{reason} A lower context level or a faster model answers sooner.": "{reason} M\u1EE9c ng\u1EEF c\u1EA3nh th\u1EA5p h\u01A1n ho\u1EB7c model nhanh h\u01A1n s\u1EBD tr\u1EA3 l\u1EDDi s\u1EDBm h\u01A1n.",
  "That run is no longer going (the plugin was restarted). Try again.": "L\u01B0\u1EE3t ch\u1EA1y \u0111\xF3 kh\xF4ng c\xF2n n\u1EEFa (plugin \u0111\xE3 \u0111\u01B0\u1EE3c kh\u1EDFi \u0111\u1ED9ng l\u1EA1i). H\xE3y th\u1EED l\u1EA1i.",
  "{url} stopped answering: {detail}": "{url} ng\u1EEBng tr\u1EA3 l\u1EDDi: {detail}",
  "{url} did not answer with JSON ({what}). A proxy or sign-in page may be in the way.": "{url} kh\xF4ng tr\u1EA3 v\u1EC1 JSON ({what}). C\xF3 th\u1EC3 m\u1ED9t proxy ho\u1EB7c trang \u0111\u0103ng nh\u1EADp \u0111ang ch\u1EB7n.",
  "an empty answer": "c\xE2u tr\u1EA3 l\u1EDDi r\u1ED7ng",
  "No API key. Add one in the Enhance Prompt panel (Models tab).": "Ch\u01B0a c\xF3 API key. Th\xEAm key trong panel Enhance Prompt (tab Model).",
  "No API key. Add one in the Enhance Prompt panel (Models tab) or set {env}.": "Ch\u01B0a c\xF3 API key. Th\xEAm key trong panel Enhance Prompt (tab Model) ho\u1EB7c \u0111\u1EB7t {env}.",
  "Could not reach {url}: {detail}": "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c {url}: {detail}",
  "{status}: {detail}": "{status}: {detail}",
  "The model returned an empty answer.": "Model tr\u1EA3 v\u1EC1 c\xE2u tr\u1EA3 l\u1EDDi r\u1ED7ng.",
  "{model} reached its limit of {max} tokens before it finished. Raise Max tokens for this model in the Models tab.": "{model} \u0111\xE3 ch\u1EA1m gi\u1EDBi h\u1EA1n {max} token tr\u01B0\u1EDBc khi vi\u1EBFt xong. H\xE3y t\u0103ng S\u1ED1 token t\u1ED1i \u0111a c\u1EE7a model n\xE0y trong tab Model.",
  "Unsafe argument for a .cmd launcher.": "Tham s\u1ED1 kh\xF4ng an to\xE0n cho tr\xECnh kh\u1EDFi ch\u1EA1y .cmd.",
  "{name} was not found. Install it and sign in, or set its full path in the model.": "Kh\xF4ng t\xECm th\u1EA5y {name}. H\xE3y c\xE0i v\xE0 \u0111\u0103ng nh\u1EADp, ho\u1EB7c \u0111\u1EB7t \u0111\u01B0\u1EDDng d\u1EABn \u0111\u1EA7y \u0111\u1EE7 trong model.",
  "Could not start {binary}: {detail}": "Kh\xF4ng kh\u1EDFi ch\u1EA1y \u0111\u01B0\u1EE3c {binary}: {detail}",
  "{kind} exited with {code}": "{kind} tho\xE1t v\u1EDBi m\xE3 {code}",
  "{kind} exited with {code}: {detail}": "{kind} tho\xE1t v\u1EDBi m\xE3 {code}: {detail}",
  "{text} (run it once in a terminal to sign in)": "{text} (h\xE3y ch\u1EA1y n\xF3 m\u1ED9t l\u1EA7n trong terminal \u0111\u1EC3 \u0111\u0103ng nh\u1EADp)",
  "{kind} returned an empty answer.": "{kind} tr\u1EA3 v\u1EC1 c\xE2u tr\u1EA3 l\u1EDDi r\u1ED7ng.",
  "No model configured. Add one in the Models tab.": "Ch\u01B0a c\u1EA5u h\xECnh model. Th\xEAm m\u1ED9t model trong tab Model.",
  "{name}: no API key": "{name}: ch\u01B0a c\xF3 API key",
  "All models failed. {list}": "T\u1EA5t c\u1EA3 model \u0111\u1EC1u l\u1ED7i. {list}",
  "{name}: {reason}": "{name}: {reason}",
  "Out of time.": "H\u1EBFt th\u1EDDi gian.",
  "Rules": "Quy t\u1EAFc",
  "Your rules": "Quy t\u1EAFc c\u1EE7a b\u1EA1n",
  "Followed in every enhanced prompt and by auto-enhance, on top of the style. A rule you add is for the project you are in.": "\u0110\u01B0\u1EE3c \xE1p d\u1EE5ng cho m\u1ECDi prompt \u0111\u01B0\u1EE3c c\u1EA3i thi\u1EC7n v\xE0 cho t\u1EF1 c\u1EA3i thi\u1EC7n, c\u1ED9ng th\xEAm v\xE0o ki\u1EC3u. Quy t\u1EAFc b\u1EA1n th\xEAm l\xE0 d\xE0nh cho d\u1EF1 \xE1n b\u1EA1n \u0111ang m\u1EDF.",
  'No rules yet. Example: "Always tell the agent to run pnpm test before finishing."': 'Ch\u01B0a c\xF3 quy t\u1EAFc. V\xED d\u1EE5: "Lu\xF4n y\xEAu c\u1EA7u agent ch\u1EA1y pnpm test tr\u01B0\u1EDBc khi xong."',
  "Every project": "M\u1ECDi d\u1EF1 \xE1n",
  "New rule": "Quy t\u1EAFc m\u1EDBi",
  "e.g. Answer in Vietnamese; keep code identifiers in English.": "VD: Vi\u1EBFt b\u1EB1ng ti\u1EBFng Vi\u1EC7t; gi\u1EEF t\xEAn trong code b\u1EB1ng ti\u1EBFng Anh.",
  "Only {name}": "Ch\u1EC9 {name}",
  "Add rule": "Th\xEAm quy t\u1EAFc",
  "Prompt structures": "C\u1EA5u tr\xFAc prompt",
  "Pick one under Options in the composer: the prompt is written under these headings instead of the style's shape.": "Ch\u1ECDn trong ph\u1EA7n Tu\u1EF3 ch\u1ECDn c\u1EE7a khung so\u1EA1n: prompt \u0111\u01B0\u1EE3c vi\u1EBFt theo c\xE1c m\u1EE5c n\xE0y thay cho d\u1EA1ng c\u1EE7a ki\u1EC3u.",
  "built-in": "c\xF3 s\u1EB5n",
  "Structure name": "T\xEAn c\u1EA5u tr\xFAc",
  "e.g. My brief": "VD: Brief c\u1EE7a t\xF4i",
  "Headings, one per line": "C\xE1c m\u1EE5c, m\u1ED7i d\xF2ng m\u1ED9t m\u1EE5c",
  "Written in any language; the rewriter translates them into the output language.": "Vi\u1EBFt b\u1EB1ng ng\xF4n ng\u1EEF n\xE0o c\u0169ng \u0111\u01B0\u1EE3c; khi vi\u1EBFt l\u1EA1i s\u1EBD d\u1ECBch sang ng\xF4n ng\u1EEF \u0111\u1EA7u ra.",
  "Add structure": "Th\xEAm c\u1EA5u tr\xFAc",
  "Structure": "C\u1EA5u tr\xFAc",
  "By style": "Theo ki\u1EC3u",
  "Task brief": "Brief nhi\u1EC7m v\u1EE5",
  "Steps": "C\xE1c b\u01B0\u1EDBc",
  "Goal": "M\u1EE5c ti\xEAu",
  "Requirements": "Y\xEAu c\u1EA7u",
  "Constraints / out of scope": "R\xE0ng bu\u1ED9c / ngo\xE0i ph\u1EA1m vi",
  "Edge cases": "Tr\u01B0\u1EDDng h\u1EE3p bi\xEAn",
  "Acceptance criteria": "Ti\xEAu ch\xED ch\u1EA5p nh\u1EADn",
  "Assumptions / questions": "Gi\u1EA3 \u0111\u1ECBnh / c\xE2u h\u1ECFi",
  "Verify": "Ki\u1EC3m tra",
  "Background": "B\u1ED1i c\u1EA3nh",
  "everywhere": "m\u1ECDi n\u01A1i",
  "The enhanced prompt is kept for {name}: go back to that project to send it.": "Prompt \u0111\xE3 c\u1EA3i thi\u1EC7n \u0111\u01B0\u1EE3c gi\u1EEF cho {name}: quay l\u1EA1i d\u1EF1 \xE1n \u0111\xF3 \u0111\u1EC3 g\u1EEDi.",
  "The project this prompt was written for is closed, so its enhanced prompt was dropped.": "D\u1EF1 \xE1n vi\u1EBFt prompt n\xE0y \u0111\xE3 \u0111\xF3ng n\xEAn prompt \u0111\xE3 c\u1EA3i thi\u1EC7n b\u1ECB b\u1ECF.",
  "Writing the prompt for {name}\u2026": "\u0110ang vi\u1EBFt prompt cho {name}\u2026",
  "Feedback": "G\xF3p \xFD",
  "Found a bug, or something that could be better? Open an issue on GitHub: it is how the plugin gets fixed and improved.": "G\u1EB7p l\u1ED7i, ho\u1EB7c th\u1EA5y ch\u1ED7 n\xE0o c\xF3 th\u1EC3 t\u1ED1t h\u01A1n? H\xE3y t\u1EA1o issue tr\xEAn GitHub: \u0111\xF3 l\xE0 c\xE1ch plugin \u0111\u01B0\u1EE3c s\u1EEDa v\xE0 c\u1EA3i thi\u1EC7n.",
  "Open an issue on GitHub": "T\u1EA1o issue tr\xEAn GitHub",
  "Open {url} in your browser.": "M\u1EDF {url} trong tr\xECnh duy\u1EC7t.",
  "Got an idea, or something that could work better? Send your feedback: it is how the plugin improves.": "B\u1EA1n c\xF3 \xFD t\u01B0\u1EDFng, ho\u1EB7c th\u1EA5y ch\u1ED7 n\xE0o c\xF3 th\u1EC3 t\u1ED1t h\u01A1n? H\xE3y g\u1EEDi g\xF3p \xFD: nh\u1EDD \u0111\xF3 plugin ng\xE0y c\xE0ng t\u1ED1t h\u01A1n.",
  "Send feedback": "G\u1EEDi g\xF3p \xFD",
  "Don't ask again": "\u0110\u1EEBng h\u1ECFi l\u1EA1i",
  "No more feedback notes. To turn them back on, open the gear icon and look under Feedback.": "S\u1EBD kh\xF4ng c\xF2n ghi ch\xFA m\u1EDDi g\xF3p \xFD n\u1EEFa. Mu\u1ED1n b\u1EADt l\u1EA1i, m\u1EDF bi\u1EC3u t\u01B0\u1EE3ng b\xE1nh r\u0103ng r\u1ED3i xem m\u1EE5c G\xF3p \xFD.",
  "Ask for feedback now and then": "Th\u1EC9nh tho\u1EA3ng m\u1EDDi g\xF3p \xFD",
  "A short note under the enhanced prompt invites your ideas, at most once in {days} days. Off: it never shows.": "M\u1ED9t ghi ch\xFA ng\u1EAFn d\u01B0\u1EDBi prompt \u0111\xE3 c\u1EA3i thi\u1EC7n m\u1EDDi b\u1EA1n g\xF3p \xFD, t\u1ED1i \u0111a {days} ng\xE0y m\u1ED9t l\u1EA7n. T\u1EAFt: kh\xF4ng bao gi\u1EDD hi\u1EC7n.",
  "Progress: {percent}%": "Ti\u1EBFn \u0111\u1ED9: {percent}%",
  "{name} is {size}; an image can be at most {max}.": "{name} n\u1EB7ng {size}; m\u1ED7i \u1EA3nh t\u1ED1i \u0111a {max}.",
  "This model cannot see images: it got their paths only, and the prompt lists them for the agent.": "Model n\xE0y kh\xF4ng xem \u0111\u01B0\u1EE3c \u1EA3nh: n\xF3 ch\u1EC9 nh\u1EADn \u0111\u01B0\u1EDDng d\u1EABn, v\xE0 prompt li\u1EC7t k\xEA c\xE1c \u1EA3nh cho agent.",
  "Remove {name}": "B\u1ECF {name}",
  "Finishing\u2026": "S\u1EAFp xong\u2026",
  "Which folder is this project?": "D\u1EF1 \xE1n n\xE0y \u1EDF th\u01B0 m\u1EE5c n\xE0o?",
  "Several projects are named {name} on the same branch. Pick its folder so its files are read and its rules are followed.": "C\xF3 nhi\u1EC1u d\u1EF1 \xE1n c\xF9ng t\xEAn {name} tr\xEAn c\xF9ng m\u1ED9t nh\xE1nh. Ch\u1ECDn th\u01B0 m\u1EE5c c\u1EE7a d\u1EF1 \xE1n n\xE0y \u0111\u1EC3 \u0111\u1ECDc \u0111\xFAng file v\xE0 \xE1p d\u1EE5ng \u0111\xFAng quy t\u1EAFc c\u1EE7a n\xF3.",
  "Project folder": "Th\u01B0 m\u1EE5c d\u1EF1 \xE1n",
  "Choose a folder": "Ch\u1ECDn th\u01B0 m\u1EE5c",
  "That attachment could not be received; try attaching it again.": "Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c t\u1EC7p \u0111\xEDnh k\xE8m n\xE0y; h\xE3y \u0111\xEDnh k\xE8m l\u1EA1i.",
  "The attached file {name} is no longer there (attachments are kept for a day). Attach it again.": "T\u1EC7p \u0111\xEDnh k\xE8m {name} kh\xF4ng c\xF2n n\u1EEFa (t\u1EC7p \u0111\xEDnh k\xE8m ch\u1EC9 \u0111\u01B0\u1EE3c gi\u1EEF m\u1ED9t ng\xE0y). H\xE3y \u0111\xEDnh k\xE8m l\u1EA1i.",
  "{name} is {size}; an attachment can be at most {max}.": "{name} n\u1EB7ng {size}; m\u1ED7i t\u1EC7p \u0111\xEDnh k\xE8m t\u1ED1i \u0111a {max}.",
  "At most {max} files per prompt.": "T\u1ED1i \u0111a {max} t\u1EC7p cho m\u1ED7i prompt.",
  "Drop files to attach": "Th\u1EA3 t\u1EC7p v\xE0o \u0111\u1EC3 \u0111\xEDnh k\xE8m",
  "Attach files": "\u0110\xEDnh k\xE8m t\u1EC7p",
  "Add": "Th\xEAm",
  "Move up": "Chuy\u1EC3n l\xEAn",
  "Move down": "Chuy\u1EC3n xu\u1ED1ng",
  "More": "Th\xEAm thao t\xE1c",
  "edited": "\u0111\xE3 s\u1EEDa",
  "Restore the default": "Kh\xF4i ph\u1EE5c m\u1EB7c \u0111\u1ECBnh",
  "Custom instructions": "H\u01B0\u1EDBng d\u1EABn ri\xEAng",
  "e.g. Write the prompt as a numbered checklist; always ask the agent to run the tests.": "VD: Vi\u1EBFt prompt th\xE0nh danh s\xE1ch vi\u1EC7c \u0111\xE1nh s\u1ED1; lu\xF4n y\xEAu c\u1EA7u agent ch\u1EA1y test.",
  "What's new": "C\xF3 g\xEC m\u1EDBi",
  "What's new in {version}": "C\xF3 g\xEC m\u1EDBi trong {version}",
  "Changelog": "Nh\u1EADt k\xFD thay \u0111\u1ED5i",
  "agents": "agent kh\xE1c",
  "agent session": "phi\xEAn agent",
  "{count} agents": "{count} agent",
  "Reading other agents' sessions": "\u0110\u1ECDc phi\xEAn c\u1EE7a c\xE1c agent kh\xE1c",
  "Read other agents' sessions": "\u0110\u1ECDc phi\xEAn c\u1EE7a c\xE1c agent kh\xE1c",
  "At the Max level: the other agents running in this workspace (kind, title, state) and the last lines of their terminals, with keys and passwords masked. Needs Read terminal output too. Off until you turn it on.": "\u1EDE m\u1EE9c T\u1ED1i \u0111a: c\xE1c agent kh\xE1c \u0111ang ch\u1EA1y trong workspace n\xE0y (lo\u1EA1i, t\xEAn, tr\u1EA1ng th\xE1i) v\xE0 nh\u1EEFng d\xF2ng cu\u1ED1i trong terminal c\u1EE7a ch\xFAng, \u0111\xE3 che key v\xE0 m\u1EADt kh\u1EA9u. C\u1EA7n b\u1EADt c\u1EA3 \u0110\u1ECDc output terminal. M\u1EB7c \u0111\u1ECBnh t\u1EAFt cho t\u1EDBi khi b\u1EA1n b\u1EADt.",
  "Other agents in this workspace": "C\xE1c agent kh\xE1c trong workspace n\xE0y",
  "Other agent session: {name}": "Phi\xEAn agent kh\xE1c: {name}",
  "Open in Copilot": "M\u1EDF trong Copilot",
  "Or start a new agent": "Ho\u1EB7c m\u1EDF agent m\u1EDBi",
  "Agent": "Agent",
  "Start": "B\u1EAFt \u0111\u1EA7u",
  'Turn on "{name}"?': 'B\u1EADt "{name}"?',
  "Read what this allows. Nothing is hidden: this is everything it does.": "\u0110\u1ECDc nh\u1EEFng g\xEC c\xF4ng t\u1EAFc n\xE0y cho ph\xE9p. Kh\xF4ng gi\u1EA5u g\xEC: \u0111\xE2y l\xE0 to\xE0n b\u1ED9 nh\u1EEFng vi\u1EC7c n\xF3 l\xE0m.",
  "You can turn it off at any time here; turning it off also withdraws this confirmation.": "B\u1EA1n c\xF3 th\u1EC3 t\u1EAFt b\u1EA5t c\u1EE9 l\xFAc n\xE0o \u1EDF \u0111\xE2y; t\u1EAFt \u0111i c\u0169ng r\xFAt l\u1EA1i x\xE1c nh\u1EADn n\xE0y.",
  "I understand, turn it on": "T\xF4i \u0111\xE3 hi\u1EC3u, b\u1EADt l\xEAn",
  "asks to confirm": "c\u1EA7n x\xE1c nh\u1EADn",
  "Turned on in Settings, but not confirmed here yet: still off.": "\u0110\xE3 b\u1EADt trong Settings nh\u01B0ng ch\u01B0a x\xE1c nh\u1EADn \u1EDF \u0111\xE2y: v\u1EABn \u0111ang t\u1EAFt.",
  "Read and confirm": "\u0110\u1ECDc v\xE0 x\xE1c nh\u1EADn",
  "Notifications": "Th\xF4ng b\xE1o",
  "Notify when a long enhance finishes": "B\xE1o khi m\u1ED9t l\u1EA7n c\u1EA3i thi\u1EC7n l\xE2u ch\u1EA1y xong",
  "Watch what agents do": "Theo d\xF5i vi\u1EC7c c\xE1c agent l\xE0m",
  "Deep and Max levels: each tool an agent runs in Copilot (its name and its target: a file path or a command, never its output) and how sessions end. Kept in memory for 45 minutes, never saved to disk.": "M\u1EE9c S\xE2u v\xE0 T\u1ED1i \u0111a: m\u1ED7i c\xF4ng c\u1EE5 m\u1ED9t agent ch\u1EA1y trong Copilot (t\xEAn v\xE0 \u0111\u1ED1i t\u01B0\u1EE3ng c\u1EE7a n\xF3: \u0111\u01B0\u1EDDng d\u1EABn t\u1EC7p ho\u1EB7c c\xE2u l\u1EC7nh, kh\xF4ng bao gi\u1EDD l\xE0 k\u1EBFt qu\u1EA3) v\xE0 c\xE1ch c\xE1c phi\xEAn k\u1EBFt th\xFAc. Ch\u1EC9 gi\u1EEF trong b\u1ED9 nh\u1EDB 45 ph\xFAt, kh\xF4ng ghi ra \u0111\u0129a.",
  "Notice files you save": "Ghi nh\u1EADn t\u1EC7p b\u1EA1n l\u01B0u",
  "Deep and Max levels: the paths of files you save in Copilot's editor (never their text), kept in memory for 45 minutes; they rank first in the code search.": "M\u1EE9c S\xE2u v\xE0 T\u1ED1i \u0111a: \u0111\u01B0\u1EDDng d\u1EABn c\xE1c t\u1EC7p b\u1EA1n l\u01B0u trong tr\xECnh so\u1EA1n th\u1EA3o c\u1EE7a Copilot (kh\xF4ng bao gi\u1EDD l\xE0 n\u1ED9i dung), gi\u1EEF trong b\u1ED9 nh\u1EDB 45 ph\xFAt; ch\xFAng \u0111\u01B0\u1EE3c \u01B0u ti\xEAn khi t\xECm code.",
  "Start new agents": "M\u1EDF agent m\u1EDBi",
  "A button that starts a new agent (Claude Code, Codex\u2026) in this workspace with the enhanced prompt, only when you press it.": "M\u1ED9t n\xFAt m\u1EDF agent m\u1EDBi (Claude Code, Codex\u2026) trong workspace n\xE0y k\xE8m prompt \u0111\xE3 c\u1EA3i thi\u1EC7n, ch\u1EC9 khi b\u1EA1n b\u1EA5m.",
  "Open files in Copilot": "M\u1EDF t\u1EC7p trong Copilot",
  "Clicking a file in the context list opens it in an editor tab.": "B\u1EA5m v\xE0o m\u1ED9t t\u1EC7p trong danh s\xE1ch ng\u1EEF c\u1EA3nh s\u1EBD m\u1EDF n\xF3 trong tab so\u1EA1n th\u1EA3o.",
  "That text is sent with your prompt to the model you run (your API provider, or the subscription CLI and its provider). It can contain code, file contents, command output and anything the agents printed.": "\u0110o\u1EA1n v\u0103n b\u1EA3n \u0111\xF3 \u0111\u01B0\u1EE3c g\u1EEDi k\xE8m prompt t\u1EDBi model b\u1EA1n ch\u1EA1y (nh\xE0 cung c\u1EA5p API c\u1EE7a b\u1EA1n, ho\u1EB7c CLI g\xF3i subscription v\xE0 nh\xE0 cung c\u1EA5p c\u1EE7a n\xF3). N\xF3 c\xF3 th\u1EC3 ch\u1EE9a code, n\u1ED9i dung t\u1EC7p, output c\u1EE7a l\u1EC7nh v\xE0 b\u1EA5t c\u1EE9 th\u1EE9 g\xEC c\xE1c agent in ra.",
  "Values that look like keys, tokens or passwords are masked first, but masking cannot catch everything.": "C\xE1c gi\xE1 tr\u1ECB tr\xF4ng nh\u01B0 key, token hay m\u1EADt kh\u1EA9u \u0111\u01B0\u1EE3c che tr\u01B0\u1EDBc, nh\u01B0ng vi\u1EC7c che kh\xF4ng th\u1EC3 b\u1EAFt \u0111\u01B0\u1EE3c m\u1ECDi th\u1EE9.",
  "Nothing of it is saved by the plugin. You can untick it in the context list for one run, or turn this switch off at any time.": "Plugin kh\xF4ng l\u01B0u l\u1EA1i g\xEC t\u1EEB \u0111\xF3. B\u1EA1n c\xF3 th\u1EC3 b\u1ECF tick trong danh s\xE1ch ng\u1EEF c\u1EA3nh cho m\u1ED9t l\u1EA7n ch\u1EA1y, ho\u1EB7c t\u1EAFt c\xF4ng t\u1EAFc n\xE0y b\u1EA5t c\u1EE9 l\xFAc n\xE0o.",
  "Copilot tells the plugin each tool an agent runs in its terminals: the tool name and what it acted on (a file path, a command line, a search pattern or a URL), never the tool's output. Copilot also tells it when a session finishes and how.": "Copilot b\xE1o cho plugin m\u1ED7i c\xF4ng c\u1EE5 m\u1ED9t agent ch\u1EA1y trong terminal: t\xEAn c\xF4ng c\u1EE5 v\xE0 \u0111\u1ED1i t\u01B0\u1EE3ng n\xF3 t\xE1c \u0111\u1ED9ng (\u0111\u01B0\u1EDDng d\u1EABn t\u1EC7p, c\xE2u l\u1EC7nh, m\u1EABu t\xECm ki\u1EBFm ho\u1EB7c URL), kh\xF4ng bao gi\u1EDD l\xE0 k\u1EBFt qu\u1EA3 c\u1EE7a c\xF4ng c\u1EE5. Copilot c\u0169ng b\xE1o khi m\u1ED9t phi\xEAn k\u1EBFt th\xFAc v\xE0 k\u1EBFt th\xFAc ra sao.",
  "This is kept in the plugin's memory only, for 45 minutes and 60 entries per workspace, and forgotten when you turn this off, delete everything, or Copilot restarts.": "Th\xF4ng tin n\xE0y ch\u1EC9 gi\u1EEF trong b\u1ED9 nh\u1EDB c\u1EE7a plugin, 45 ph\xFAt v\xE0 t\u1ED1i \u0111a 60 m\u1EE5c m\u1ED7i workspace, v\xE0 b\u1ECB qu\xEAn khi b\u1EA1n t\u1EAFt c\xF4ng t\u1EAFc, x\xF3a to\xE0n b\u1ED9, ho\u1EB7c khi Copilot kh\u1EDFi \u0111\u1ED9ng l\u1EA1i.",
  "At the Deep and Max levels, the recent entries of the focused workspace are sent with your prompt to the model you run. Command lines are masked for obvious keys and passwords.": "\u1EDE m\u1EE9c S\xE2u v\xE0 T\u1ED1i \u0111a, c\xE1c m\u1EE5c g\u1EA7n \u0111\xE2y c\u1EE7a workspace \u0111ang m\u1EDF \u0111\u01B0\u1EE3c g\u1EEDi k\xE8m prompt t\u1EDBi model b\u1EA1n ch\u1EA1y. C\xE1c c\xE2u l\u1EC7nh \u0111\u01B0\u1EE3c che nh\u1EEFng key v\xE0 m\u1EADt kh\u1EA9u d\u1EC5 nh\u1EADn ra.",
  "The plugin only watches: it never changes or blocks what an agent does.": "Plugin ch\u1EC9 quan s\xE1t: n\xF3 kh\xF4ng bao gi\u1EDD thay \u0111\u1ED5i hay ch\u1EB7n vi\u1EC7c agent l\xE0m.",
  "Adds a button that starts a new agent (Claude Code, Codex, Gemini\u2026) in a new terminal of this workspace, and types the enhanced prompt into it once it is ready.": "Th\xEAm m\u1ED9t n\xFAt m\u1EDF agent m\u1EDBi (Claude Code, Codex, Gemini\u2026) trong m\u1ED9t terminal m\u1EDBi c\u1EE7a workspace n\xE0y, v\xE0 g\xF5 prompt \u0111\xE3 c\u1EA3i thi\u1EC7n v\xE0o khi agent s\u1EB5n s\xE0ng.",
  "The agent runs with your user account, exactly as if you had opened it yourself: it can read and change files and run commands, within that agent's own permission settings.": "Agent ch\u1EA1y b\u1EB1ng t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng c\u1EE7a b\u1EA1n, y nh\u01B0 khi b\u1EA1n t\u1EF1 m\u1EDF: n\xF3 c\xF3 th\u1EC3 \u0111\u1ECDc, s\u1EEDa t\u1EC7p v\xE0 ch\u1EA1y l\u1EC7nh, trong ph\u1EA1m vi c\xE0i \u0111\u1EB7t quy\u1EC1n c\u1EE7a ch\xEDnh agent \u0111\xF3.",
  "It only happens when you press the button. The plugin never starts an agent by itself.": "Vi\u1EC7c n\xE0y ch\u1EC9 x\u1EA3y ra khi b\u1EA1n b\u1EA5m n\xFAt. Plugin kh\xF4ng bao gi\u1EDD t\u1EF1 m\u1EDF agent.",
  "Enhanced prompt ready ({model}, {seconds} s)": "Prompt \u0111\xE3 c\u1EA3i thi\u1EC7n xong ({model}, {seconds} gi\xE2y)",
  "Started a new {agent} agent with the prompt.": "\u0110\xE3 m\u1EDF agent {agent} m\u1EDBi v\u1EDBi prompt.",
  "Recent agent activity": "Ho\u1EA1t \u0111\u1ED9ng g\u1EA7n \u0111\xE2y c\u1EE7a c\xE1c agent",
  "Files you saved lately": "C\xE1c t\u1EC7p b\u1EA1n v\u1EEBa l\u01B0u",
  "activity": "ho\u1EA1t \u0111\u1ED9ng",
  "saved files": "t\u1EC7p \u0111\xE3 l\u01B0u",
  "Starting new agents is off in Settings, or not confirmed yet.": "M\u1EDF agent m\u1EDBi \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t, ho\u1EB7c ch\u01B0a \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn.",
  "Opening files in Copilot is off in Settings.": "M\u1EDF t\u1EC7p trong Copilot \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t.",
  "online model lists are off in Settings": "danh s\xE1ch model tr\u1EF1c tuy\u1EBFn \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t",
  "Copilot could not store the API key: this machine has no key store for it. Use a key from an environment variable, or a subscription CLI.": "Copilot kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c API key: m\xE1y n\xE0y kh\xF4ng c\xF3 kho kh\xF3a cho n\xF3. H\xE3y d\xF9ng key t\u1EEB bi\u1EBFn m\xF4i tr\u01B0\u1EDDng, ho\u1EB7c m\u1ED9t CLI \u0111\u0103ng k\xFD.",
  "{name} is waiting for an answer from you, and what is typed now could be taken as that answer.": "{name} \u0111ang ch\u1EDD b\u1EA1n tr\u1EA3 l\u1EDDi, v\xE0 n\u1ED9i dung g\xF5 v\xE0o l\xFAc n\xE0y c\xF3 th\u1EC3 b\u1ECB coi l\xE0 c\xE2u tr\u1EA3 l\u1EDDi \u0111\xF3.",
  "The model returned no prompt.": "Model kh\xF4ng tr\u1EA3 v\u1EC1 prompt n\xE0o.",
  "This version of Copilot cannot do that yet.": "Phi\xEAn b\u1EA3n Copilot n\xE0y ch\u01B0a l\xE0m \u0111\u01B0\u1EE3c vi\u1EC7c \u0111\xF3.",
  "Invalid request.": "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7.",
  "Reads which other agents run in this workspace (kind, title, state) and the last lines of each one's terminal, every time you enhance at the Max level: as many agents and lines as you set below the switch (4 agents and 80 lines by default, at most 8 and 300).": "\u0110\u1ECDc c\xE1c agent kh\xE1c \u0111ang ch\u1EA1y trong workspace n\xE0y (lo\u1EA1i, t\xEAn, tr\u1EA1ng th\xE1i) v\xE0 nh\u1EEFng d\xF2ng cu\u1ED1i trong terminal c\u1EE7a t\u1EEBng agent, m\u1ED7i l\u1EA7n b\u1EA1n c\u1EA3i thi\u1EC7n \u1EDF m\u1EE9c T\u1ED1i \u0111a: s\u1ED1 agent v\xE0 s\u1ED1 d\xF2ng theo l\u1EF1a ch\u1ECDn b\xEAn d\u01B0\u1EDBi c\xF4ng t\u1EAFc (m\u1EB7c \u0111\u1ECBnh 4 agent v\xE0 80 d\xF2ng, t\u1ED1i \u0111a 8 v\xE0 300).",
  "Agents read": "S\u1ED1 agent \u0111\u1ECDc",
  "Lines per agent": "S\u1ED1 d\xF2ng m\u1ED7i agent",
  "Used only while this switch is on and confirmed.": "Ch\u1EC9 d\xF9ng khi c\xF4ng t\u1EAFc n\xE0y \u0111ang b\u1EADt v\xE0 \u0111\xE3 x\xE1c nh\u1EADn.",
  "{model} declined this request ({category}). Use another model, or rephrase the request.": "{model} t\u1EEB ch\u1ED1i y\xEAu c\u1EA7u n\xE0y ({category}). H\xE3y d\xF9ng model kh\xE1c, ho\u1EB7c vi\u1EBFt l\u1EA1i y\xEAu c\u1EA7u.",
  "Send right after enhancing": "C\u1EA3i thi\u1EC7n xong g\u1EEDi lu\xF4n",
  "On for small, low-risk requests, with an agent that asks before it does anything hard to undo. Leave it off when the agent runs with wide permissions, or when a wrong instruction would be costly.": "B\u1EADt cho c\xE1c y\xEAu c\u1EA7u nh\u1ECF, \xEDt r\u1EE7i ro, v\u1EDBi agent lu\xF4n h\u1ECFi tr\u01B0\u1EDBc khi l\xE0m vi\u1EC7c kh\xF3 ho\xE0n t\xE1c. \u0110\u1EC3 t\u1EAFt khi agent ch\u1EA1y v\u1EDBi quy\u1EC1n r\u1ED9ng, ho\u1EB7c khi m\u1ED9t ch\u1EC9 d\u1EABn sai s\u1EBD g\xE2y thi\u1EC7t h\u1EA1i l\u1EDBn.",
  "Whenever one of these does not hold, nothing is sent: the result stays in the composer with a note that says why, and you send it yourself.": "H\u1EC5 m\u1ED9t \u0111i\u1EC1u ki\u1EC7n kh\xF4ng th\u1ECFa th\xEC kh\xF4ng g\u1EEDi g\xEC c\u1EA3: k\u1EBFt qu\u1EA3 n\u1EB1m l\u1EA1i trong khung so\u1EA1n k\xE8m m\u1ED9t ghi ch\xFA n\xF3i r\xF5 l\xFD do, v\xE0 b\u1EA1n t\u1EF1 g\u1EEDi.",
  "Enhance and send without reading (Ctrl+Enter)": "C\u1EA3i thi\u1EC7n r\u1ED3i g\u1EEDi lu\xF4n, kh\xF4ng \u0111\u1ECDc l\u1EA1i (Ctrl+Enter)",
  "Not sent by itself.": "Ch\u01B0a t\u1EF1 g\u1EEDi.",
  "Read the prompt and send it yourself.": "H\xE3y \u0111\u1ECDc prompt r\u1ED3i t\u1EF1 g\u1EEDi.",
  "Copilot could not tell which project this is.": "Copilot kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c \u0111\xE2y l\xE0 d\u1EF1 \xE1n n\xE0o.",
  "The project in focus changed while it ran; the prompt waits in the project it was written in.": "D\u1EF1 \xE1n \u0111ang m\u1EDF \u0111\xE3 \u0111\u1ED5i trong l\xFAc ch\u1EA1y; prompt \u0111ang ch\u1EDD \u1EDF d\u1EF1 \xE1n n\u01A1i n\xF3 \u0111\u01B0\u1EE3c vi\u1EBFt.",
  "The terminal picked when you started is closed or no longer the one picked.": "Terminal \u0111\u01B0\u1EE3c ch\u1ECDn l\xFAc b\u1EA1n b\u1EAFt \u0111\u1EA7u \u0111\xE3 \u0111\xF3ng ho\u1EB7c kh\xF4ng c\xF2n l\xE0 terminal \u0111ang ch\u1ECDn.",
  "{label} is a plain terminal, not an agent.": "{label} l\xE0 terminal th\u01B0\u1EDDng, kh\xF4ng ph\u1EA3i agent.",
  "The text changed while it ran.": "N\u1ED9i dung \u0111\xE3 thay \u0111\u1ED5i trong l\xFAc ch\u1EA1y.",
  "Saved as a file.": "\u0110\xE3 l\u01B0u th\xE0nh file.",
  "The file could not be saved.": "Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c file.",
  "Save as a file": "L\u01B0u th\xE0nh file",
  "Saved {when} \xB7 {count} prompts": "L\u01B0u l\xFAc {when} \xB7 {count} prompt",
  "{name} is still working.": "{name} v\u1EABn \u0111ang l\xE0m vi\u1EC7c.",
  "{name} is waiting for an answer from you.": "{name} \u0111ang ch\u1EDD b\u1EA1n tr\u1EA3 l\u1EDDi.",
  "Copilot does not say whether {name} is idle.": "Copilot kh\xF4ng cho bi\u1EBFt {name} c\xF3 \u0111ang r\u1EA3nh hay kh\xF4ng.",
  "Copilot session unavailable": "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c phi\xEAn Copilot",
  "Attached Copilot session": "Phi\xEAn Copilot \u0111\u01B0\u1EE3c k\u1EBFt n\u1ED1i",
  "Send to Copilot (Ctrl+Enter)": "G\u1EEDi t\u1EDBi Copilot (Ctrl+Enter)",
  "Prompt preferences": "T\xF9y ch\u1ECDn prompt",
  "Default style": "Ki\u1EC3u m\u1EB7c \u0111\u1ECBnh",
  "Default context level": "M\u1EE9c ng\u1EEF c\u1EA3nh m\u1EB7c \u0111\u1ECBnh",
  "Default output language": "Ng\xF4n ng\u1EEF \u0111\u1EA7u ra m\u1EB7c \u0111\u1ECBnh",
  "Additional context files": "C\xE1c file ng\u1EEF c\u1EA3nh b\u1ED5 sung",
  "Excluded paths": "\u0110\u01B0\u1EDDng d\u1EABn lo\u1EA1i tr\u1EEB",
  "Timeout per model (seconds)": "Th\u1EDDi gian ch\u1EDD m\u1ED7i model (gi\xE2y)",
  "History limit": "Gi\u1EDBi h\u1EA1n l\u1ECBch s\u1EED",
  "Adapt instructions to Copilot": "\u0110i\u1EC1u ch\u1EC9nh h\u01B0\u1EDBng d\u1EABn cho Copilot",
  "Auto-enhance appended text": "V\u0103n b\u1EA3n th\xEAm khi t\u1EF1 c\u1EA3i thi\u1EC7n",
  "Auto-enhance minimum characters": "S\u1ED1 k\xFD t\u1EF1 t\u1ED1i thi\u1EC3u \u0111\u1EC3 t\u1EF1 c\u1EA3i thi\u1EC7n",
  "Include context in auto-enhance": "Th\xEAm ng\u1EEF c\u1EA3nh khi t\u1EF1 c\u1EA3i thi\u1EC7n",
  'It does nothing while "Send to Copilot" is off.': "Kh\xF4ng ho\u1EA1t \u0111\u1ED9ng khi t\u1EAFt \u201CG\u1EEDi t\u1EDBi Copilot\u201D.",
  "Auto-enhance Copilot session prompts": "T\u1EF1 c\u1EA3i thi\u1EC7n prompt c\u1EE7a phi\xEAn Copilot",
  "These switches control what Enhance Prompt reads, sends and stores. They are checked for every run.": "C\xE1c c\xF4ng t\u1EAFc ki\u1EC3m so\xE1t nh\u1EEFng g\xEC Enhance Prompt \u0111\u1ECDc, g\u1EEDi v\xE0 l\u01B0u. M\u1ED7i l\u1EA7n ch\u1EA1y \u0111\u1EC1u ki\u1EC3m tra ch\xFAng.",
  "Unavailable in Copilot": "Ch\u01B0a c\xF3 trong Copilot",
  "The current canvas SDK does not provide this capability.": "SDK canvas hi\u1EC7n t\u1EA1i ch\u01B0a cung c\u1EA5p ch\u1EE9c n\u0103ng n\xE0y.",
  "API keys (protected by Windows)": "API key (\u0111\u01B0\u1EE3c Windows b\u1EA3o v\u1EC7)",
  "Copilot prompts are left unchanged.": "Gi\u1EEF nguy\xEAn prompt c\u1EE7a Copilot.",
  "Appends the text from Prompt preferences when Copilot invokes the prompt hook. No model call.": "Th\xEAm v\u0103n b\u1EA3n trong T\xF9y ch\u1ECDn prompt khi Copilot g\u1ECDi hook. Kh\xF4ng g\u1ECDi model.",
  "A fast API model rewrites hooked prompts with a two-second budget. Failures preserve the original. Prompts sent from this panel are skipped.": "Model API nhanh vi\u1EBFt l\u1EA1i prompt trong hai gi\xE2y. N\u1EBFu l\u1ED7i th\xEC gi\u1EEF nguy\xEAn. B\u1ECF qua prompt g\u1EEDi t\u1EEB b\u1EA3ng n\xE0y.",
  "Send to Copilot": "G\u1EEDi t\u1EDBi Copilot",
  "Send a new message to the attached Copilot session when you click Send. Off: use Copy instead.": "Nh\u1EA5n G\u1EEDi \u0111\u1EC3 g\u1EEDi tin nh\u1EAFn m\u1EDBi v\xE0o phi\xEAn Copilot \u0111\u01B0\u1EE3c k\u1EBFt n\u1ED1i. Khi t\u1EAFt, d\xF9ng Sao ch\xE9p.",
  "Send starts a new Copilot turn. Busy, blocked, disconnected and unknown sessions refuse the message.": "G\u1EEDi b\u1EAFt \u0111\u1EA7u m\u1ED9t l\u01B0\u1EE3t Copilot m\u1EDBi. Kh\xF4ng g\u1EEDi khi phi\xEAn b\u1EADn, ch\u1EDD tr\u1EA3 l\u1EDDi, m\u1EA5t k\u1EBFt n\u1ED1i ho\u1EB7c kh\xF4ng r\xF5 tr\u1EA1ng th\xE1i.",
  "Prompts, results and context are saved as plain text in the plugin data folder. Drafts are separated by Copilot session.": "Prompt, k\u1EBFt qu\u1EA3 v\xE0 ng\u1EEF c\u1EA3nh \u0111\u01B0\u1EE3c l\u01B0u d\u1EA1ng v\u0103n b\u1EA3n thu\u1EA7n trong th\u01B0 m\u1EE5c d\u1EEF li\u1EC7u plugin. B\u1EA3n nh\xE1p t\xE1ch ri\xEAng theo phi\xEAn Copilot.",
  "Ctrl+Enter, or the button next to Enhance, enhances and sends a new Copilot message without review. Enter alone stops at the result. Off until you turn it on.": "Ctrl+Enter ho\u1EB7c n\xFAt c\u1EA1nh C\u1EA3i thi\u1EC7n s\u1EBD c\u1EA3i thi\u1EC7n v\xE0 g\u1EEDi tin nh\u1EAFn Copilot m\xE0 kh\xF4ng xem l\u1EA1i. Enter ch\u1EC9 t\u1EA1o k\u1EBFt qu\u1EA3. M\u1EB7c \u0111\u1ECBnh t\u1EAFt.",
  "Copilot acts on a prompt you have not read. A model can misunderstand your request or add an unwanted step.": "Copilot th\u1EF1c hi\u1EC7n prompt b\u1EA1n ch\u01B0a \u0111\u1ECDc. Model c\xF3 th\u1EC3 hi\u1EC3u sai ho\u1EB7c th\xEAm b\u01B0\u1EDBc kh\xF4ng mong mu\u1ED1n.",
  "Adds a second button next to Enhance. Ctrl+Enter enhances the prompt and sends the result as a new Copilot message. Enter alone only enhances.": "Th\xEAm n\xFAt c\u1EA1nh C\u1EA3i thi\u1EC7n. Ctrl+Enter c\u1EA3i thi\u1EC7n r\u1ED3i g\u1EEDi k\u1EBFt qu\u1EA3 th\xE0nh tin nh\u1EAFn Copilot m\u1EDBi. Enter ch\u1EC9 c\u1EA3i thi\u1EC7n.",
  "Automatic sending requires the same attached session and project, an idle session, and unchanged input. Closing or cancelling the run prevents sending.": "Ch\u1EC9 t\u1EF1 g\u1EEDi khi v\u1EABn c\xF9ng phi\xEAn v\xE0 d\u1EF1 \xE1n, phi\xEAn \u0111ang r\u1EA3nh v\xE0 n\u1ED9i dung kh\xF4ng \u0111\u1ED5i. \u0110\xF3ng ho\u1EB7c h\u1EE7y s\u1EBD kh\xF4ng g\u1EEDi.",
  'It needs "Send to Copilot" to be on, and the checks of that switch still apply.': "C\u1EA7n b\u1EADt \u201CG\u1EEDi t\u1EDBi Copilot\u201D v\xE0 v\u1EABn ki\u1EC3m tra c\xE1c \u0111i\u1EC1u ki\u1EC7n c\u1EE7a c\xF4ng t\u1EAFc \u0111\xF3.",
  "Sending to Copilot is off in Settings.": "G\u1EEDi t\u1EDBi Copilot \u0111ang t\u1EAFt trong C\xE0i \u0111\u1EB7t.",
  "Download started.": "\u0110\xE3 b\u1EAFt \u0111\u1EA7u t\u1EA3i xu\u1ED1ng.",
  "Changes could not be saved. Check the canvas connection and try again.": "Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c thay \u0111\u1ED5i. Ki\u1EC3m tra k\u1EBFt n\u1ED1i canvas r\u1ED3i th\u1EED l\u1EA1i.",
  "The canvas could not connect. Close it and open Enhance Prompt again from Copilot.": "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c canvas. \u0110\xF3ng r\u1ED3i m\u1EDF l\u1EA1i Enhance Prompt t\u1EEB Copilot.",
  "Copilot is busy, waiting for your answer, or disconnected. Wait until the session is idle before sending.": "Copilot \u0111ang b\u1EADn, ch\u1EDD b\u1EA1n tr\u1EA3 l\u1EDDi ho\u1EB7c \u0111\xE3 m\u1EA5t k\u1EBFt n\u1ED1i. Ch\u1EDD phi\xEAn r\u1EA3nh tr\u01B0\u1EDBc khi g\u1EEDi.",
  "A prompt was just sent. Wait for Copilot before sending again.": "V\u1EEBa g\u1EEDi m\u1ED9t prompt. Ch\u1EDD Copilot tr\u01B0\u1EDBc khi g\u1EEDi ti\u1EBFp.",
  "Changes the text Copilot receives; the chat still shows your original message. Off by default. Ambiguous prompts are left unchanged.": "Thay \u0111\u1ED5i v\u0103n b\u1EA3n Copilot nh\u1EADn \u0111\u01B0\u1EE3c; cu\u1ED9c tr\xF2 chuy\u1EC7n v\u1EABn hi\u1EC3n th\u1ECB tin nh\u1EAFn g\u1ED1c. M\u1EB7c \u0111\u1ECBnh t\u1EAFt. Gi\u1EEF nguy\xEAn n\u1EBFu kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c ph\u1EA7n c\u1EA7n thay."
};
var ZH = {
  "Copilot model discovery": "Copilot \u6A21\u578B\u53D1\u73B0",
  "Refresh the Copilot model list first, then reopen these logs. This section is included when you copy the logs.": "\u8BF7\u5148\u5237\u65B0 Copilot \u6A21\u578B\u5217\u8868\uFF0C\u518D\u91CD\u65B0\u6253\u5F00\u65E5\u5FD7\u3002\u590D\u5236\u65E5\u5FD7\u65F6\u4F1A\u5305\u542B\u6B64\u90E8\u5206\u3002",
  "The plugin could not verify the desktop runtime. Open Show Logs and share the Copilot model discovery section.": "\u63D2\u4EF6\u65E0\u6CD5\u9A8C\u8BC1\u684C\u9762\u8FD0\u884C\u65F6\u3002\u8BF7\u6253\u5F00\u201C\u663E\u793A\u65E5\u5FD7\u201D\u5E76\u5206\u4EAB\u201CCopilot \u6A21\u578B\u53D1\u73B0\u201D\u90E8\u5206\u3002",
  "The required desktop SDK could not be loaded. Open Show Logs and share the Copilot model discovery section.": "\u65E0\u6CD5\u52A0\u8F7D\u6240\u9700\u7684\u684C\u9762 SDK\u3002\u8BF7\u6253\u5F00\u201C\u663E\u793A\u65E5\u5FD7\u201D\u5E76\u5206\u4EAB\u201CCopilot \u6A21\u578B\u53D1\u73B0\u201D\u90E8\u5206\u3002",
  "Copilot could not return its model list. Try Refresh, then open Show Logs and share the Copilot model discovery section if it still fails.": "Copilot \u65E0\u6CD5\u8FD4\u56DE\u6A21\u578B\u5217\u8868\u3002\u8BF7\u5C1D\u8BD5\u5237\u65B0\uFF1B\u5982\u679C\u4ECD\u7136\u5931\u8D25\uFF0C\u8BF7\u6253\u5F00\u201C\u663E\u793A\u65E5\u5FD7\u201D\u5E76\u5206\u4EAB\u201CCopilot \u6A21\u578B\u53D1\u73B0\u201D\u90E8\u5206\u3002",
  "No eligible Copilot models were returned for this session. Check your Copilot sign-in and model access, then refresh. Show Logs includes the model discovery results.": "\u6B64\u4F1A\u8BDD\u672A\u8FD4\u56DE\u7B26\u5408\u6761\u4EF6\u7684 Copilot \u6A21\u578B\u3002\u8BF7\u68C0\u67E5 Copilot \u767B\u5F55\u72B6\u6001\u548C\u6A21\u578B\u8BBF\u95EE\u6743\u9650\uFF0C\u7136\u540E\u5237\u65B0\u3002\u201C\u663E\u793A\u65E5\u5FD7\u201D\u4E2D\u5305\u542B\u6A21\u578B\u53D1\u73B0\u7ED3\u679C\u3002",
  "Show Logs": "\u663E\u793A\u65E5\u5FD7",
  "Diagnostic logs": "\u8BCA\u65AD\u65E5\u5FD7",
  "Copy logs": "\u590D\u5236\u65E5\u5FD7",
  "Collecting logs\u2026": "\u6B63\u5728\u6536\u96C6\u65E5\u5FD7\u2026",
  "Reproduce the problem, then open these logs and copy them into your issue. They contain recent operation results and error codes, without prompts, file contents, paths, account names, or API keys. Nothing is uploaded automatically.": "\u8BF7\u5148\u590D\u73B0\u95EE\u9898\uFF0C\u518D\u6253\u5F00\u65E5\u5FD7\u5E76\u590D\u5236\u5230\u95EE\u9898\u62A5\u544A\u4E2D\u3002\u65E5\u5FD7\u5305\u542B\u8FD1\u671F\u64CD\u4F5C\u7ED3\u679C\u548C\u9519\u8BEF\u4EE3\u7801\uFF0C\u4E0D\u5305\u542B\u63D0\u793A\u8BCD\u3001\u6587\u4EF6\u5185\u5BB9\u3001\u8DEF\u5F84\u3001\u8D26\u6237\u540D\u6216 API \u5BC6\u94A5\u3002\u4E0D\u4F1A\u81EA\u52A8\u4E0A\u4F20\u4EFB\u4F55\u5185\u5BB9\u3002",
  "Up to 200 events per component are kept in memory. Restarting clears them. Reopen this dialog to capture newer events.": "\u6BCF\u4E2A\u7EC4\u4EF6\u5728\u5185\u5B58\u4E2D\u6700\u591A\u4FDD\u7559 200 \u6761\u4E8B\u4EF6\uFF0C\u91CD\u542F\u540E\u4F1A\u6E05\u9664\u3002\u91CD\u65B0\u6253\u5F00\u6B64\u5BF9\u8BDD\u6846\u53EF\u83B7\u53D6\u6700\u65B0\u4E8B\u4EF6\u3002",
  "The worker could not be reached. These logs include panel diagnostics only.": "\u65E0\u6CD5\u8FDE\u63A5\u540E\u53F0\u8FDB\u7A0B\u3002\u8FD9\u4E9B\u65E5\u5FD7\u4EC5\u5305\u542B\u9762\u677F\u8BCA\u65AD\u4FE1\u606F\u3002",
  "Clipboard access is unavailable. The logs are selected; copy them with Ctrl+C or Command+C.": "\u65E0\u6CD5\u8BBF\u95EE\u526A\u8D34\u677F\u3002\u65E5\u5FD7\u5DF2\u9009\u4E2D\uFF0C\u8BF7\u6309 Ctrl+C \u6216 Command+C \u590D\u5236\u3002",
  "No enabled API model: Copilot helpers and subscription CLIs are excluded from the two-second chat hook.": "\u6CA1\u6709\u5DF2\u542F\u7528\u7684 API \u6A21\u578B\uFF1ACopilot \u540E\u53F0\u4F1A\u8BDD\u548C\u8BA2\u9605 CLI \u4E0D\u9002\u7528\u4E8E\u4E24\u79D2\u9650\u5236\u7684\u804A\u5929 hook\u3002",
  "Refresh API and Copilot model lists and the public Claude Code schema. Copilot rewriting needs this enabled to verify model access.": "\u5237\u65B0 API\u3001Copilot \u6A21\u578B\u5217\u8868\u53CA\u516C\u5F00\u7684 Claude Code \u914D\u7F6E\u67B6\u6784\u3002Copilot \u6539\u5199\u9700\u8981\u5F00\u542F\u6B64\u9009\u9879\u4EE5\u9A8C\u8BC1\u6A21\u578B\u8BBF\u95EE\u6743\u9650\u3002",
  "Model-list requests use the provider account. List refreshes send no prompt or project context.": "\u6A21\u578B\u5217\u8868\u8BF7\u6C42\u4F7F\u7528\u63D0\u4F9B\u5546\u8D26\u6237\u3002\u5237\u65B0\u5217\u8868\u4E0D\u4F1A\u53D1\u9001\u63D0\u793A\u8BCD\u6216\u9879\u76EE\u4E0A\u4E0B\u6587\u3002",
  "Models available through this Copilot session. Access is checked again before each rewrite.": "\u6B64 Copilot \u4F1A\u8BDD\u53EF\u7528\u7684\u6A21\u578B\u3002\u6BCF\u6B21\u6539\u5199\u524D\u90FD\u4F1A\u91CD\u65B0\u68C0\u67E5\u8BBF\u95EE\u6743\u9650\u3002",
  "Refresh to check which Copilot models are available.": "\u5237\u65B0\u4EE5\u68C0\u67E5\u53EF\u7528\u7684 Copilot \u6A21\u578B\u3002",
  "Uses your GitHub Copilot account in the background. No npm install, API key or separate runtime. Copilot usage charges apply. It never falls back to another provider and is unavailable for chat auto-enhance.": "\u5728\u540E\u53F0\u4F7F\u7528\u4F60\u7684 GitHub Copilot \u8D26\u6237\u3002\u65E0\u9700\u5B89\u88C5 npm\u3001API \u5BC6\u94A5\u6216\u5355\u72EC\u7684\u8FD0\u884C\u65F6\u3002\u6309 Copilot \u7528\u91CF\u8BA1\u8D39\u3002\u4E0D\u4F1A\u56DE\u9000\u5230\u5176\u4ED6\u63D0\u4F9B\u5546\uFF0C\u4E5F\u4E0D\u652F\u6301\u804A\u5929\u81EA\u52A8\u589E\u5F3A\u3002",
  "GitHub Copilot \xB7 background rewrite": "GitHub Copilot \xB7 \u540E\u53F0\u6539\u5199",
  "Add GitHub Copilot to rewrite with your Copilot account, or choose an external provider.": "\u6DFB\u52A0 GitHub Copilot\uFF0C\u4F7F\u7528\u4F60\u7684 Copilot \u8D26\u6237\u6539\u5199\uFF0C\u6216\u9009\u62E9\u5916\u90E8\u63D0\u4F9B\u5546\u3002",
  "It needs an enabled API model. Copilot background rewriting and subscription CLIs are excluded from its two-second limit. Add an API model, or use Rules.": "\u9700\u8981\u4E00\u4E2A\u5DF2\u542F\u7528\u7684 API \u6A21\u578B\u3002Copilot \u540E\u53F0\u6539\u5199\u548C\u8BA2\u9605 CLI \u4E0D\u9002\u7528\u4E8E\u4E24\u79D2\u7684\u65F6\u9650\u3002\u8BF7\u6DFB\u52A0 API \u6A21\u578B\u6216\u4F7F\u7528\u89C4\u5219\u3002",
  "Copilot background rewriting is unavailable. Restart or update GitHub Copilot and reopen this plugin. No separate SDK or runtime is installed.": "Copilot \u540E\u53F0\u6539\u5199\u4E0D\u53EF\u7528\u3002\u8BF7\u91CD\u542F\u6216\u66F4\u65B0 GitHub Copilot\uFF0C\u7136\u540E\u91CD\u65B0\u6253\u5F00\u63D2\u4EF6\u3002\u4E0D\u4F1A\u5B89\u88C5\u5355\u72EC\u7684 SDK \u6216\u8FD0\u884C\u65F6\u3002",
  "The background runtime could not verify the same GitHub account as this Copilot session. Check your existing Copilot sign-in. No prompt was sent.": "\u540E\u53F0\u8FD0\u884C\u65F6\u65E0\u6CD5\u786E\u8BA4\u4E0E\u6B64 Copilot \u4F1A\u8BDD\u4F7F\u7528\u540C\u4E00 GitHub \u8D26\u6237\u3002\u8BF7\u68C0\u67E5\u73B0\u6709\u7684 Copilot \u767B\u5F55\u72B6\u6001\u3002\u672A\u53D1\u9001\u4EFB\u4F55\u63D0\u793A\u8BCD\u3002",
  "This model is not available through GitHub Copilot in both sessions. Refresh the model list and choose a Copilot model.": "\u6B64\u6A21\u578B\u65E0\u6CD5\u5728\u4E24\u4E2A\u4F1A\u8BDD\u4E2D\u90FD\u901A\u8FC7 GitHub Copilot \u4F7F\u7528\u3002\u8BF7\u5237\u65B0\u5217\u8868\u5E76\u9009\u62E9 Copilot \u6A21\u578B\u3002",
  "This Copilot model does not report image support. Choose a model with image support or remove the images.": "\u6B64 Copilot \u6A21\u578B\u672A\u58F0\u660E\u652F\u6301\u56FE\u7247\u3002\u8BF7\u9009\u62E9\u652F\u6301\u56FE\u7247\u7684\u6A21\u578B\u6216\u79FB\u9664\u56FE\u7247\u3002",
  "GitHub Copilot": "GitHub Copilot",
  "A little more thought. A clearer prompt.": "\u591A\u4E00\u5206\u601D\u8003\uFF0C\u8BA9\u63D0\u793A\u8BCD\u66F4\u6E05\u6670\u3002",
  "A fresh page for your next idea": "\u4E3A\u4E0B\u4E00\u4E2A\u60F3\u6CD5\u5F00\u542F\u65B0\u7684\u4E00\u9875",
  "Draft ready to enhance": "\u8349\u7A3F\u5DF2\u5C31\u7EEA\uFF0C\u53EF\u4EE5\u589E\u5F3A",
  "Enhancing your request\u2026": "\u6B63\u5728\u589E\u5F3A\u4F60\u7684\u8BF7\u6C42\u2026",
  "Prompt ready to review": "\u63D0\u793A\u8BCD\u5DF2\u5C31\u7EEA\uFF0C\u8BF7\u68C0\u67E5",
  "Enhancement failed": "\u589E\u5F3A\u5931\u8D25",
  "Enhancement cancelled": "\u589E\u5F3A\u5DF2\u53D6\u6D88",
  "Switch to light mode": "\u5207\u6362\u5230\u6D45\u8272\u6A21\u5F0F",
  "Switch to dark mode": "\u5207\u6362\u5230\u6DF1\u8272\u6A21\u5F0F",
  "Plugin sections": "\u63D2\u4EF6\u5BFC\u822A",
  "Enhance": "\u4F18\u5316",
  "Write a request": "\u5199\u4E0B\u9700\u6C42",
  "Review and send": "\u5BA1\u9605\u5E76\u53D1\u9001",
  "Enter to enhance \xB7 Shift+Enter for a new line": "Enter \u4F18\u5316 \xB7 Shift+Enter \u6362\u884C",
  "Enhance and send": "\u4F18\u5316\u5E76\u53D1\u9001",
  "Enhance and send skips review. Enhance lets you edit first.": "\u201C\u4F18\u5316\u5E76\u53D1\u9001\u201D\u4F1A\u8DF3\u8FC7\u5BA1\u9605\u3002\u201C\u4F18\u5316\u201D\u5141\u8BB8\u5148\u7F16\u8F91\u518D\u53D1\u9001\u3002",
  "Context to include": "\u8981\u5305\u542B\u7684\u4E0A\u4E0B\u6587",
  "Uncheck anything you do not want sent to the rewriting model.": "\u53D6\u6D88\u52FE\u9009\u4E0D\u60F3\u53D1\u9001\u7ED9\u6539\u5199\u6A21\u578B\u7684\u5185\u5BB9\u3002",
  "Edit the enhanced prompt below, then copy it or send it to Copilot.": "\u5728\u4E0B\u65B9\u7F16\u8F91\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\uFF0C\u7136\u540E\u590D\u5236\u6216\u53D1\u9001\u5230 Copilot\u3002",
  "Copilot session unavailable. You can still copy or save this prompt.": "Copilot \u4F1A\u8BDD\u4E0D\u53EF\u7528\u3002\u4F60\u4ECD\u53EF\u590D\u5236\u6216\u4FDD\u5B58\u6B64\u63D0\u793A\u8BCD\u3002",
  "Wait for the current operation to finish before sending.": "\u8BF7\u7B49\u5F85\u5F53\u524D\u64CD\u4F5C\u5B8C\u6210\u540E\u518D\u53D1\u9001\u3002",
  "Reuse": "\u590D\u7528",
  "Send to Copilot is off in Settings. You can still copy or save this prompt.": "\u8BBE\u7F6E\u4E2D\u5DF2\u5173\u95ED\u201C\u53D1\u9001\u5230 Copilot\u201D\u3002\u4F60\u4ECD\u53EF\u590D\u5236\u6216\u4FDD\u5B58\u6B64\u63D0\u793A\u8BCD\u3002",
  "AI file picker skipped: {reason}": "\u5DF2\u8DF3\u8FC7 AI \u9009\u62E9\u6587\u4EF6\uFF1A{reason}",
  "Preview skips the AI file picker.": "\u9884\u89C8\u4F1A\u8DF3\u8FC7 AI \u9009\u62E9\u6587\u4EF6\u3002",
  "Project files are off in Settings: workspace and agent only.": "\u201C\u8BBE\u7F6E\u201D\u4E2D\u5DF2\u5173\u95ED\u8BFB\u53D6\u9879\u76EE\u6587\u4EF6\uFF1A\u4EC5\u4F7F\u7528\u5DE5\u4F5C\u533A\u548C agent\u3002",
  "No files matched the prompt; the agent will be told to locate them.": "\u6CA1\u6709\u6587\u4EF6\u5339\u914D\u63D0\u793A\u8BCD\uFF1B\u4F1A\u8BA9 agent \u81EA\u884C\u67E5\u627E\u3002",
  "Not a git repository: no git context.": "\u4E0D\u662F git \u4ED3\u5E93\uFF1A\u6CA1\u6709 git \u4E0A\u4E0B\u6587\u3002",
  "Terminal output is off in Settings.": "\u201C\u8BBE\u7F6E\u201D\u4E2D\u5DF2\u5173\u95ED\u8BFB\u53D6\u7EC8\u7AEF\u8F93\u51FA\u3002",
  "Remote (SSH/WSL) workspace: project files are not readable from the plugin.": "\u8FDC\u7A0B\uFF08SSH/WSL\uFF09\u5DE5\u4F5C\u533A\uFF1A\u63D2\u4EF6\u65E0\u6CD5\u8BFB\u53D6\u9879\u76EE\u6587\u4EF6\u3002",
  "Could not tell which folder the workspace is in; project files skipped.": "\u65E0\u6CD5\u786E\u5B9A\u5DE5\u4F5C\u533A\u6240\u5728\u7684\u6587\u4EF6\u5939\uFF1B\u5DF2\u8DF3\u8FC7\u9879\u76EE\u6587\u4EF6\u3002",
  "No focused workspace.": "\u6CA1\u6709\u6253\u5F00\u7684\u5DE5\u4F5C\u533A\u3002",
  "trimmed": "\u5DF2\u622A\u65AD",
  "picked by AI": "AI \u9009\u62E9",
  "keyword match": "\u5173\u952E\u8BCD\u5339\u914D",
  "terminal": "\u7EC8\u7AEF",
  "file": "\u6587\u4EF6",
  "git": "git",
  "tree": "\u76EE\u5F55\u6811",
  "stack": "\u6280\u672F\u6808",
  "rules": "\u89C4\u5219",
  "agent": "agent",
  "workspace": "\u5DE5\u4F5C\u533A",
  "Recent output: {name}": "\u6700\u8FD1\u8F93\u51FA\uFF1A{name}",
  "Git status ({count} changed)": "Git \u72B6\u6001\uFF08{count} \u5904\u66F4\u6539\uFF09",
  "Repository tree ({count} files)": "\u76EE\u5F55\u6811\uFF08{count} \u4E2A\u6587\u4EF6\uFF09",
  "Uncommitted changes": "\u672A\u63D0\u4EA4\u7684\u66F4\u6539",
  "Recent commits": "\u6700\u8FD1\u63D0\u4EA4",
  "Stack & commands": "\u6280\u672F\u6808\u4E0E\u547D\u4EE4",
  "Target agent": "\u76EE\u6807 agent",
  "Workspace": "\u5DE5\u4F5C\u533A",
  "{count} lines": "{count} \u884C",
  "{count} changed": "{count} \u5904\u66F4\u6539",
  "{count} files": "{count} \u4E2A\u6587\u4EF6",
  "Starting\u2026": "\u6B63\u5728\u5F00\u59CB\u2026",
  "Cancelled": "\u5DF2\u53D6\u6D88",
  "Enhance failed": "\u4F18\u5316\u5931\u8D25",
  "Try again": "\u91CD\u8BD5",
  "Done": "\u5B8C\u6210",
  "Panel language": "\u754C\u9762\u8BED\u8A00",
  "Reading workspace": "\u8BFB\u53D6\u5DE5\u4F5C\u533A",
  "Reading project rules and stack": "\u8BFB\u53D6\u9879\u76EE\u89C4\u5219\u548C\u6280\u672F\u6808",
  "Reading git changes": "\u8BFB\u53D6 git \u66F4\u6539",
  "Finding relevant code": "\u67E5\u627E\u76F8\u5173\u4EE3\u7801",
  "AI picking files": "AI \u9009\u62E9\u6587\u4EF6",
  "Reading terminal output": "\u8BFB\u53D6\u7EC8\u7AEF\u8F93\u51FA",
  "Writing the prompt": "\u7F16\u5199\u63D0\u793A\u8BCD",
  "latest": "\u6700\u65B0",
  "Models": "\u6A21\u578B",
  "Settings": "\u8BBE\u7F6E",
  "That terminal is no longer open.": "\u90A3\u4E2A\u7EC8\u7AEF\u5DF2\u7ECF\u5173\u95ED\u3002",
  "Typed into {label}, without Enter.": "\u5DF2\u8F93\u5165\u5230 {label}\uFF0C\u672A\u6309 Enter\u3002",
  "Type it without Enter": "\u8F93\u5165\u4F46\u4E0D\u6309 Enter",
  "Back in the history.": "\u5DF2\u653E\u56DE\u5386\u53F2\u3002",
  "It could not be brought back.": "\u65E0\u6CD5\u6062\u590D\u3002",
  "This prompt was written in {name}: read it before you send it here.": "\u8FD9\u6761\u63D0\u793A\u8BCD\u662F\u5728 {name} \u4E2D\u5199\u7684\uFF1A\u5728\u8FD9\u91CC\u53D1\u9001\u524D\u8BF7\u5148\u8BFB\u4E00\u904D\u3002",
  "Something is still running here. Try again when it has finished.": "\u8FD9\u91CC\u8FD8\u6709\u4EFB\u52A1\u5728\u8FD0\u884C\u3002\u7B49\u5B83\u7ED3\u675F\u540E\u518D\u8BD5\u3002",
  "Opened from the history. What the composer held was replaced.": "\u5DF2\u4ECE\u5386\u53F2\u6253\u5F00\u3002\u8F93\u5165\u6846\u4E2D\u539F\u6709\u7684\u5185\u5BB9\u5DF2\u88AB\u66FF\u6362\u3002",
  "Undo": "\u64A4\u9500",
  "Removed from the history.": "\u5DF2\u4ECE\u5386\u53F2\u4E2D\u5220\u9664\u3002",
  "Auto-enhance left a prompt for {agent} unchanged: {reason}": "\u81EA\u52A8\u4F18\u5316\u6CA1\u6709\u6539\u52A8\u53D1\u7ED9 {agent} \u7684\u4E00\u6761\u63D0\u793A\u8BCD\uFF1A{reason}",
  "Found on this machine. It uses your subscription: no API key needed.": "\u5728\u672C\u673A\u627E\u5230\u3002\u5B83\u4F7F\u7528\u4F60\u7684\u8BA2\u9605\uFF1A\u65E0\u9700 API key\u3002",
  "Use {name}": "\u4F7F\u7528 {name}",
  "Other models": "\u5176\u4ED6\u6A21\u578B",
  "Which prompts to show": "\u663E\u793A\u54EA\u4E9B\u63D0\u793A\u8BCD",
  "Nothing here matches.": "\u6CA1\u6709\u5339\u914D\u7684\u5185\u5BB9\u3002",
  "Hide the enhanced prompt": "\u6536\u8D77\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD",
  "Show the enhanced prompt": "\u67E5\u770B\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD",
  "API keys cannot be saved on this machine": "\u8FD9\u53F0\u673A\u5668\u65E0\u6CD5\u4FDD\u5B58 API key",
  "Copilot found no key store here to keep them in. Use a key from an environment variable (the switch for it is in Settings), or a subscription CLI.": "Copilot \u5728\u8FD9\u53F0\u673A\u5668\u4E0A\u627E\u4E0D\u5230\u53EF\u5B58\u653E\u5B83\u4EEC\u7684\u5BC6\u94A5\u5B58\u50A8\u3002\u8BF7\u4F7F\u7528\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 key\uFF08\u5F00\u5173\u5728\u201C\u8BBE\u7F6E\u201D\u91CC\uFF09\uFF0C\u6216\u8BA2\u9605 CLI\u3002",
  "What this switch does, what can go wrong, and when it is worth turning on.": "\u8FD9\u4E2A\u5F00\u5173\u505A\u4EC0\u4E48\u3001\u53EF\u80FD\u51FA\u4EC0\u4E48\u95EE\u9898\uFF0C\u4EE5\u53CA\u4EC0\u4E48\u65F6\u5019\u503C\u5F97\u5F00\u542F\u3002",
  "What it does": "\u5B83\u505A\u4EC0\u4E48",
  "What can go wrong": "\u53EF\u80FD\u7684\u98CE\u9669",
  "When to turn it on": "\u4EC0\u4E48\u65F6\u5019\u5F00\u542F",
  "Last prompt ({when}): rewritten for {agent} with {model}.": "\u6700\u8FD1\u4E00\u6761\u63D0\u793A\u8BCD\uFF08{when}\uFF09\uFF1A\u5DF2\u7528 {model} \u4E3A {agent} \u6539\u5199\u3002",
  "Last prompt ({when}): your text was added for {agent}.": "\u6700\u8FD1\u4E00\u6761\u63D0\u793A\u8BCD\uFF08{when}\uFF09\uFF1A\u5DF2\u4E3A {agent} \u52A0\u4E0A\u4F60\u7684\u6587\u5B57\u3002",
  "Last prompt ({when}): left unchanged for {agent}. {reason}": "\u6700\u8FD1\u4E00\u6761\u63D0\u793A\u8BCD\uFF08{when}\uFF09\uFF1A\u53D1\u7ED9 {agent} \u65F6\u672A\u6539\u52A8\u3002{reason}",
  "Risk and when to use it": "\u98CE\u9669\u4E0E\u9002\u7528\u573A\u666F",
  "File and folder names, your agent rules, the README and manifest files go to the model you run. Files that look like secrets (.env, keys, certificates) are never read.": "\u6587\u4EF6\u548C\u6587\u4EF6\u5939\u540D\u79F0\u3001\u4F60\u7684 agent \u89C4\u5219\u3001README \u548C\u6E05\u5355\u6587\u4EF6\u4F1A\u53D1\u9001\u7ED9\u4F60\u8FD0\u884C\u7684\u6A21\u578B\u3002\u770B\u8D77\u6765\u50CF\u673A\u5BC6\u7684\u6587\u4EF6\uFF08.env\u3001\u5BC6\u94A5\u3001\u8BC1\u4E66\uFF09\u7EDD\u4E0D\u4F1A\u88AB\u8BFB\u53D6\u3002",
  "Keep it on for prompts that name real files and commands. Turn it off in a project whose contents must not reach a model provider.": "\u4FDD\u6301\u5F00\u542F\uFF0C\u63D0\u793A\u8BCD\u624D\u80FD\u5199\u51FA\u771F\u5B9E\u7684\u6587\u4EF6\u548C\u547D\u4EE4\u3002\u5982\u679C\u9879\u76EE\u5185\u5BB9\u4E0D\u80FD\u4EA4\u7ED9\u6A21\u578B\u63D0\u4F9B\u65B9\uFF0C\u5C31\u5173\u95ED\u5B83\u3002",
  "Branch names, commit subjects, the list of changed files and the diff of your uncommitted changes go to the model. Nothing in the repository is changed.": "\u5206\u652F\u540D\u3001\u63D0\u4EA4\u6807\u9898\u3001\u5DF2\u66F4\u6539\u6587\u4EF6\u5217\u8868\u4EE5\u53CA\u672A\u63D0\u4EA4\u66F4\u6539\u7684 diff \u4F1A\u53D1\u9001\u7ED9\u6A21\u578B\u3002\u4ED3\u5E93\u4E2D\u7684\u4EFB\u4F55\u5185\u5BB9\u90FD\u4E0D\u4F1A\u88AB\u6539\u52A8\u3002",
  "On when a prompt should know what you are working on right now. Off when uncommitted changes may hold something you would not share.": "\u5F53\u63D0\u793A\u8BCD\u9700\u8981\u77E5\u9053\u4F60\u773C\u4E0B\u5728\u505A\u4EC0\u4E48\u65F6\u5F00\u542F\u3002\u5982\u679C\u672A\u63D0\u4EA4\u7684\u66F4\u6539\u91CC\u53EF\u80FD\u6709\u4E0D\u60F3\u5206\u4EAB\u7684\u5185\u5BB9\uFF0C\u5C31\u5173\u95ED\u3002",
  "A terminal shows whatever was printed: paths, logs, data. Values that look like keys, tokens or passwords are masked first, which cannot catch everything.": "\u7EC8\u7AEF\u4F1A\u663E\u793A\u6240\u6709\u6253\u5370\u51FA\u6765\u7684\u5185\u5BB9\uFF1A\u8DEF\u5F84\u3001\u65E5\u5FD7\u3001\u6570\u636E\u3002\u770B\u8D77\u6765\u50CF\u5BC6\u94A5\u3001token \u6216\u5BC6\u7801\u7684\u503C\u4F1A\u5148\u88AB\u906E\u853D\uFF0C\u4F46\u65E0\u6CD5\u4FDD\u8BC1\u5168\u90E8\u906E\u4F4F\u3002",
  "On to fix an error that is on screen in the terminal. Off when your terminals show secrets or customer data.": "\u8981\u4FEE\u590D\u7EC8\u7AEF\u91CC\u6B63\u663E\u793A\u7684\u9519\u8BEF\u65F6\u5F00\u542F\u3002\u5982\u679C\u7EC8\u7AEF\u4F1A\u663E\u793A\u673A\u5BC6\u6216\u5BA2\u6237\u6570\u636E\uFF0C\u5C31\u5173\u95ED\u3002",
  "Terminals you did not pick are read too, and their text goes to the model: code, file contents and command output of other work.": "\u4F60\u6CA1\u6709\u9009\u4E2D\u7684\u7EC8\u7AEF\u4E5F\u4F1A\u88AB\u8BFB\u53D6\uFF0C\u5176\u6587\u672C\u4F1A\u53D1\u9001\u7ED9\u6A21\u578B\uFF1A\u5176\u4ED6\u5DE5\u4F5C\u7684\u4EE3\u7801\u3001\u6587\u4EF6\u5185\u5BB9\u548C\u547D\u4EE4\u8F93\u51FA\u3002",
  "On when several agents share a task and a new prompt must not repeat or undo their work. Otherwise leave it off.": "\u5F53\u591A\u4E2A agent \u534F\u4F5C\u540C\u4E00\u4EFB\u52A1\u3001\u65B0\u63D0\u793A\u8BCD\u4E0D\u80FD\u91CD\u590D\u6216\u63A8\u7FFB\u5B83\u4EEC\u7684\u5DE5\u4F5C\u65F6\u5F00\u542F\u3002\u5176\u4ED6\u60C5\u51B5\u4FDD\u6301\u5173\u95ED\u3002",
  "Tool names, file paths and command lines of every agent in Copilot are kept in memory and sent with Deep and Max prompts. A command line can carry more than you expect.": "Copilot \u4E2D\u6BCF\u4E2A agent \u7684\u5DE5\u5177\u540D\u3001\u6587\u4EF6\u8DEF\u5F84\u548C\u547D\u4EE4\u884C\u4F1A\u4FDD\u7559\u5728\u5185\u5B58\u4E2D\uFF0C\u5E76\u968F\u201C\u6DF1\u5165\u201D\u548C\u201C\u6700\u5927\u201D\u7EA7\u522B\u7684\u63D0\u793A\u8BCD\u53D1\u9001\u3002\u547D\u4EE4\u884C\u91CC\u7684\u5185\u5BB9\u53EF\u80FD\u6BD4\u4F60\u60F3\u7684\u591A\u3002",
  "On when prompts should follow on from what the agents just did. Off when command lines may hold secrets.": "\u5F53\u63D0\u793A\u8BCD\u9700\u8981\u63A5\u7740 agent \u521A\u505A\u7684\u4E8B\u60C5\u5199\u65F6\u5F00\u542F\u3002\u5982\u679C\u547D\u4EE4\u884C\u91CC\u53EF\u80FD\u6709\u673A\u5BC6\uFF0C\u5C31\u5173\u95ED\u3002",
  "Only paths are noted, never the text of a file. A path can still say what you are working on.": "\u53EA\u8BB0\u5F55\u8DEF\u5F84\uFF0C\u7EDD\u4E0D\u8BB0\u5F55\u6587\u4EF6\u5185\u5BB9\u3002\u4E0D\u8FC7\u8DEF\u5F84\u672C\u8EAB\u4E5F\u53EF\u80FD\u900F\u9732\u4F60\u5728\u505A\u4EC0\u4E48\u3002",
  "On when you edit in Copilot and want those files found first. It changes nothing if you edit elsewhere.": "\u5F53\u4F60\u5728 Copilot \u4E2D\u7F16\u8F91\u5E76\u5E0C\u671B\u8FD9\u4E9B\u6587\u4EF6\u4F18\u5148\u88AB\u627E\u5230\u65F6\u5F00\u542F\u3002\u5982\u679C\u4F60\u5728\u522B\u5904\u7F16\u8F91\uFF0C\u5B83\u4E0D\u8D77\u4F5C\u7528\u3002",
  "On for the normal flow. Off to be sure nothing is ever typed for you: Copy still works.": "\u65E5\u5E38\u4F7F\u7528\u4FDD\u6301\u5F00\u542F\u3002\u5173\u95ED\u540E\u7EDD\u4E0D\u4F1A\u66FF\u4F60\u8F93\u5165\u4EFB\u4F55\u5185\u5BB9\uFF1A\u590D\u5236\u4ECD\u7136\u53EF\u7528\u3002",
  "A new agent runs with your user account and its own permission settings: it can change files and run commands.": "\u65B0 agent \u4EE5\u4F60\u7684\u7528\u6237\u8D26\u6237\u548C\u5B83\u81EA\u5DF1\u7684\u6743\u9650\u8BBE\u7F6E\u8FD0\u884C\uFF1A\u5B83\u53EF\u4EE5\u4FEE\u6539\u6587\u4EF6\u5E76\u6267\u884C\u547D\u4EE4\u3002",
  "On when you often start a fresh agent for each task. It only happens when you press Start.": "\u5F53\u4F60\u5E38\u4E3A\u6BCF\u4E2A\u4EFB\u52A1\u542F\u52A8\u4E00\u4E2A\u65B0 agent \u65F6\u5F00\u542F\u3002\u53EA\u6709\u5728\u4F60\u6309\u4E0B\u201C\u542F\u52A8\u201D\u65F6\u624D\u4F1A\u53D1\u751F\u3002",
  "An editor tab opens in Copilot's window. Nothing is read or changed by it.": "\u4F1A\u5728 Copilot \u7A97\u53E3\u4E2D\u6253\u5F00\u4E00\u4E2A\u7F16\u8F91\u5668\u6807\u7B7E\u9875\u3002\u5B83\u4E0D\u8BFB\u53D6\u4E5F\u4E0D\u66F4\u6539\u4EFB\u4F55\u5185\u5BB9\u3002",
  "On to look at what was read before you send. Off if the panel should never change what Copilot shows.": "\u60F3\u5728\u53D1\u9001\u524D\u67E5\u770B\u8BFB\u53D6\u4E86\u4EC0\u4E48\u65F6\u5F00\u542F\u3002\u5982\u679C\u4E0D\u5E0C\u671B\u9762\u677F\u6539\u53D8 Copilot \u663E\u793A\u7684\u5185\u5BB9\uFF0C\u5C31\u5173\u95ED\u3002",
  "On to reuse earlier prompts and to find your draft again after a restart. Off on a shared machine, or when prompts hold things that must not be kept.": "\u60F3\u590D\u7528\u4EE5\u524D\u7684\u63D0\u793A\u8BCD\u3001\u91CD\u542F\u540E\u627E\u56DE\u8349\u7A3F\u65F6\u5F00\u542F\u3002\u5728\u5171\u7528\u7684\u673A\u5668\u4E0A\uFF0C\u6216\u63D0\u793A\u8BCD\u542B\u6709\u4E0D\u80FD\u4FDD\u7559\u7684\u5185\u5BB9\u65F6\u5173\u95ED\u3002",
  "A key from your environment is sent to that provider like a saved one, and its account pays for the calls.": "\u73AF\u5883\u4E2D\u7684 key \u4F1A\u50CF\u5DF2\u4FDD\u5B58\u7684 key \u4E00\u6837\u53D1\u9001\u7ED9\u5BF9\u5E94\u7684\u63D0\u4F9B\u65B9\uFF0C\u8C03\u7528\u8D39\u7528\u7531\u8BE5 key \u7684\u8D26\u6237\u627F\u62C5\u3002",
  "On when your keys already live in the environment and you do not want to store them twice. Off to use only the keys you saved in Models.": "\u5F53 key \u5DF2\u5728\u73AF\u5883\u53D8\u91CF\u4E2D\u3001\u4E0D\u60F3\u518D\u5B58\u4E00\u4EFD\u65F6\u5F00\u542F\u3002\u5173\u95ED\u540E\u53EA\u4F7F\u7528\u4F60\u5728\u201C\u6A21\u578B\u201D\u4E2D\u4FDD\u5B58\u7684 key\u3002",
  "On to see new models without updating the plugin. Off for no network traffic besides the model calls.": "\u60F3\u4E0D\u66F4\u65B0\u63D2\u4EF6\u5C31\u770B\u5230\u65B0\u6A21\u578B\u65F6\u5F00\u542F\u3002\u9664\u4E86\u6A21\u578B\u8C03\u7528\u5916\u4E0D\u60F3\u6709\u4EFB\u4F55\u7F51\u7EDC\u6D41\u91CF\u65F6\u5173\u95ED\u3002",
  "What it may read": "\u5141\u8BB8\u8BFB\u53D6",
  "What it may do": "\u5141\u8BB8\u6267\u884C",
  "What it may keep and fetch": "\u5141\u8BB8\u4FDD\u5B58\u548C\u83B7\u53D6",
  "working": "\u5DE5\u4F5C\u4E2D",
  "needs you": "\u9700\u8981\u4F60",
  "waiting": "\u7B49\u5F85\u4E2D",
  "done": "\u5DF2\u5B8C\u6210",
  "Read project files": "\u8BFB\u53D6\u9879\u76EE\u6587\u4EF6",
  "Run git": "\u8FD0\u884C git",
  "Read terminal output": "\u8BFB\u53D6\u7EC8\u7AEF\u8F93\u51FA",
  "Save history": "\u4FDD\u5B58\u5386\u53F2",
  "Use API keys from environment variables": "\u4F7F\u7528\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 API key",
  "Fetch model lists online": "\u5728\u7EBF\u83B7\u53D6\u6A21\u578B\u5217\u8868",
  "Agent rules, README, manifest files and the file list of the focused workspace (Standard level and above). Off: only workspace and agent names are used.": "\u5F53\u524D\u5DE5\u4F5C\u533A\u7684 agent \u89C4\u5219\u3001README\u3001\u6E05\u5355\u6587\u4EF6\u548C\u6587\u4EF6\u5217\u8868\uFF08\u6807\u51C6\u7EA7\u522B\u53CA\u4EE5\u4E0A\uFF09\u3002\u5173\u95ED\u540E\u53EA\u4F7F\u7528\u5DE5\u4F5C\u533A\u548C agent \u540D\u79F0\u3002",
  "Read-only git status, log, diff, ls-files and grep in the focused workspace (Deep and Max levels).": "\u5728\u5F53\u524D\u5DE5\u4F5C\u533A\u53EA\u8BFB\u8FD0\u884C git status\u3001log\u3001diff\u3001ls-files \u548C grep\uFF08\u6DF1\u5165\u548C\u6700\u5927\u7EA7\u522B\uFF09\u3002",
  "The last lines of the terminal you picked, at the Max level only.": "\u6240\u9009\u7EC8\u7AEF\u7684\u6700\u540E\u51E0\u884C\uFF0C\u4EC5\u5728\u6700\u5927\u7EA7\u522B\u3002",
  "Keep your prompts and enhanced prompts in the History tab, on this machine only.": "\u5728\u201C\u5386\u53F2\u201D\u4E2D\u4FDD\u5B58\u539F\u59CB\u548C\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\uFF0C\u4EC5\u4FDD\u5B58\u5728\u672C\u673A\u3002",
  "OPENAI_API_KEY, ANTHROPIC_API_KEY and the others, when a model has no saved key.": "\u5F53\u6A21\u578B\u6CA1\u6709\u4FDD\u5B58\u7684 key \u65F6\uFF0C\u4F7F\u7528 OPENAI_API_KEY\u3001ANTHROPIC_API_KEY \u7B49\u3002",
  "Stored on this machine": "\u672C\u673A\u5B58\u50A8",
  "Nothing is sent anywhere except your prompt and the context you allow, to the model you run. No tracking or analytics.": "\u9664\u4F60\u5141\u8BB8\u7684\u63D0\u793A\u8BCD\u548C\u4E0A\u4E0B\u6587\u53D1\u9001\u5230\u4F60\u4F7F\u7528\u7684\u6A21\u578B\u5916\uFF0C\u4E0D\u4F1A\u53D1\u9001\u4EFB\u4F55\u5185\u5BB9\u3002\u65E0\u8FFD\u8E2A\u3001\u65E0\u7EDF\u8BA1\u3002",
  "History": "\u5386\u53F2",
  "Saved models": "\u5DF2\u4FDD\u5B58\u6A21\u578B",
  "Cached model lists": "\u5DF2\u7F13\u5B58\u7684\u6A21\u578B\u5217\u8868",
  "Clear model lists": "\u6E05\u9664\u6A21\u578B\u5217\u8868",
  "Delete everything": "\u5220\u9664\u5168\u90E8",
  "Press again to delete everything": "\u518D\u6309\u4E00\u6B21\u5220\u9664\u5168\u90E8",
  "All plugin data deleted.": "\u5DF2\u5220\u9664\u63D2\u4EF6\u7684\u5168\u90E8\u6570\u636E\u3002",
  "History cleared.": "\u5DF2\u6E05\u7A7A\u5386\u53F2\u3002",
  "Model lists cleared.": "\u5DF2\u6E05\u9664\u6A21\u578B\u5217\u8868\u3002",
  "Auto (fallback)": "\u81EA\u52A8\uFF08\u56DE\u9000\uFF09",
  "Options": "\u9009\u9879",
  "Refine: use the enhanced prompt as the new input": "\u7EE7\u7EED\u4F18\u5316\uFF1A\u628A\u7ED3\u679C\u4F5C\u4E3A\u65B0\u7684\u8F93\u5165",
  "Add one in the Models tab.": "\u5728\u201C\u6A21\u578B\u201D\u6807\u7B7E\u4E2D\u6DFB\u52A0\u3002",
  "Enable": "\u542F\u7528",
  "Disable": "\u505C\u7528",
  "Uses your subscription": "\u4F7F\u7528\u4F60\u7684\u8BA2\u9605",
  "default": "\u9ED8\u8BA4",
  "Describe what you want the agent to do\u2026": "\u63CF\u8FF0\u4F60\u5E0C\u671B agent \u505A\u4EC0\u4E48\u2026",
  "Auto": "\u81EA\u52A8",
  "Your models": "\u4F60\u7684\u6A21\u578B",
  "Fallback": "\u56DE\u9000",
  "Auto-enhance": "\u81EA\u52A8\u4F18\u5316",
  "Max context level": "\u6700\u5927\u4E0A\u4E0B\u6587\u7EA7\u522B",
  "your default": "\u4F60\u7684\u9ED8\u8BA4",
  "Choose a model": "\u9009\u62E9\u6A21\u578B",
  "Other (type the id)\u2026": "\u5176\u4ED6\uFF08\u8F93\u5165 id\uFF09\u2026",
  "Refresh model list": "\u5237\u65B0\u6A21\u578B\u5217\u8868",
  "Model id": "\u6A21\u578B id",
  "Loading the model list\u2026": "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u5217\u8868\u2026",
  "Could not load the list ({error}). Type the model id.": "\u65E0\u6CD5\u52A0\u8F7D\u5217\u8868\uFF08{error}\uFF09\u3002\u8BF7\u8F93\u5165\u6A21\u578B id\u3002",
  "{count} models from {source}, refreshed daily.": "{count} \u4E2A\u6A21\u578B\uFF0C\u6765\u81EA {source}\uFF0C\u6BCF\u5929\u81EA\u52A8\u5237\u65B0\u3002",
  "Uses the model set in the CLI itself.": "\u4F7F\u7528 CLI \u81EA\u8EAB\u8BBE\u7F6E\u7684\u6A21\u578B\u3002",
  "Add the API key to list the models.": "\u586B\u5199 API key \u540E\u5373\u53EF\u5217\u51FA\u6A21\u578B\u3002",
  "{name} now uses {model}.": "{name} \u73B0\u5728\u4F7F\u7528 {model}\u3002",
  "Off": "\u5173\u95ED",
  "Your prompt": "\u4F60\u7684\u63D0\u793A\u8BCD",
  "Style": "\u98CE\u683C",
  "Context": "\u4E0A\u4E0B\u6587",
  "Model": "\u6A21\u578B",
  "Output language": "\u8F93\u51FA\u8BED\u8A00",
  "Output: same as prompt": "\u8F93\u51FA\uFF1A\u4E0E\u63D0\u793A\u8BCD\u76F8\u540C",
  "Output: English": "\u8F93\u51FA\uFF1AEnglish",
  "Output: Vietnamese": "\u8F93\u51FA\uFF1ATi\u1EBFng Vi\u1EC7t",
  "Output: Chinese": "\u8F93\u51FA\uFF1A\u4E2D\u6587",
  "Output: default ({value})": "\u8F93\u51FA\uFF1A\u9ED8\u8BA4 ({value})",
  "Cancel": "\u53D6\u6D88",
  "Gathering\u2026": "\u6536\u96C6\u4E2D\u2026",
  "Send to": "\u53D1\u9001\u5230",
  "Enhanced prompt": "\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD",
  "Copy": "\u590D\u5236",
  "Clear": "\u6E05\u9664",
  "No model yet": "\u8FD8\u6CA1\u6709\u6A21\u578B",
  "No API key yet": "\u8FD8\u6CA1\u6709 API key",
  "Open Models": "\u6253\u5F00\u6A21\u578B",
  "{kind} \xB7 {chars} chars": "{kind} \xB7 {chars} \u5B57\u7B26",
  "Fell back after: {list}": "\u5DF2\u56DE\u9000\uFF0C\u5931\u8D25\u7684\u6A21\u578B\uFF1A{list}",
  "Cancelled.": "\u5DF2\u53D6\u6D88\u3002",
  "Sent to {label}.": "\u5DF2\u53D1\u9001\u5230 {label}\u3002",
  "{label} did not accept the text.": "{label} \u672A\u63A5\u6536\u6587\u672C\u3002",
  "Copied to clipboard.": "\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\u3002",
  "Copy failed: {error}": "\u590D\u5236\u5931\u8D25\uFF1A{error}",
  "Saved {name}.": "\u5DF2\u4FDD\u5B58 {name}\u3002",
  "Added {name}. Use Test to check it is signed in.": "\u5DF2\u6DFB\u52A0 {name}\u3002\u70B9\u201C\u6D4B\u8BD5\u201D\u786E\u8BA4\u5DF2\u767B\u5F55\u3002",
  "Auto-enhanced ({mode}) a prompt for {agent}.": "\u5DF2\u4E3A {agent} \u81EA\u52A8\u4F18\u5316 ({mode}) \u4E00\u6761\u63D0\u793A\u8BCD\u3002",
  "an agent": "\u67D0\u4E2A agent",
  "Dismiss": "\u5173\u95ED",
  "Close": "\u5173\u95ED",
  "Loading": "\u52A0\u8F7D\u4E2D",
  "No history yet": "\u6682\u65E0\u5386\u53F2",
  "Enhanced prompts show up here.": "\u4F18\u5316\u8FC7\u7684\u63D0\u793A\u8BCD\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
  "Search history": "\u641C\u7D22\u5386\u53F2",
  "Open in Enhance tab": "\u5728\u201C\u4F18\u5316\u201D\u4E2D\u6253\u5F00",
  "Delete": "\u5220\u9664",
  "{shown} of {total}": "{shown} / {total}",
  "Clear history": "\u6E05\u7A7A\u5386\u53F2",
  "auto": "\u81EA\u52A8",
  "Fallback to the next model when one fails": "\u6A21\u578B\u5931\u8D25\u65F6\u56DE\u9000\u5230\u4E0B\u4E00\u4E2A",
  "Models are tried top to bottom. Disabled models are skipped.": "\u6A21\u578B\u6309\u4ECE\u4E0A\u5230\u4E0B\u5C1D\u8BD5\uFF0C\u5DF2\u7981\u7528\u7684\u4F1A\u8DF3\u8FC7\u3002",
  "Using API keys from your environment": "\u6B63\u5728\u4F7F\u7528\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 API key",
  "Add a model below to customize; then only your saved models are used.": "\u5728\u4E0B\u65B9\u6DFB\u52A0\u6A21\u578B\u4EE5\u81EA\u5B9A\u4E49\uFF1B\u4E4B\u540E\u53EA\u4F7F\u7528\u5DF2\u4FDD\u5B58\u7684\u6A21\u578B\u3002",
  "No models yet": "\u8FD8\u6CA1\u6709\u6A21\u578B",
  "Use your subscription, no API key": "\u4F7F\u7528\u4F60\u7684\u8BA2\u9605\uFF0C\u65E0\u9700 API key",
  "Found on this machine. Uses the account the CLI is signed in with.": "\u5728\u672C\u673A\u627E\u5230\u3002\u4F7F\u7528 CLI \u5DF2\u767B\u5F55\u7684\u8D26\u53F7\u3002",
  "Add model": "\u6DFB\u52A0\u6A21\u578B",
  "Add a model": "\u6DFB\u52A0\u6A21\u578B",
  "Edit {name}": "\u7F16\u8F91 {name}",
  "Preset": "\u9884\u8BBE",
  "Name": "\u540D\u79F0",
  "API format": "API \u683C\u5F0F",
  "Base URL": "Base URL",
  "Model (optional)": "\u6A21\u578B\uFF08\u53EF\u9009\uFF09",
  "API key": "API key",
  "Leave empty to keep the saved key": "\u7559\u7A7A\u4EE5\u4FDD\u7559\u5DF2\u4FDD\u5B58\u7684 key",
  "Or set {env}": "\u6216\u8BBE\u7F6E {env}",
  "Not needed for local servers": "\u672C\u5730\u670D\u52A1\u65E0\u9700 key",
  "Command": "\u547D\u4EE4",
  "Arguments": "\u53C2\u6570",
  "Found on PATH automatically; or a full path": "\u81EA\u52A8\u4ECE PATH \u67E5\u627E\uFF1B\u6216\u586B\u5199\u5B8C\u6574\u8DEF\u5F84",
  "CLI default": "CLI \u9ED8\u8BA4",
  "Runs the CLI already signed in on this machine, so it uses your subscription instead of an API key. Slower than an API (a few seconds per call), so it is skipped by auto-enhance.": "\u8FD0\u884C\u672C\u673A\u5DF2\u767B\u5F55\u7684 CLI\uFF0C\u4F7F\u7528\u4F60\u7684\u8BA2\u9605\u800C\u975E API key\u3002\u6BD4 API \u6162\uFF08\u6BCF\u6B21\u51E0\u79D2\uFF09\uFF0C\u56E0\u6B64\u81EA\u52A8\u4F18\u5316\u4F1A\u8DF3\u8FC7\u5B83\u3002",
  "Max tokens": "\u6700\u5927 token",
  "{value} tokens": "{value} token",
  "Save": "\u4FDD\u5B58",
  "Test": "\u6D4B\u8BD5",
  "Edit": "\u7F16\u8F91",
  "key saved": "\u5DF2\u4FDD\u5B58 key",
  "key from env": "\u73AF\u5883\u53D8\u91CF key",
  "no key": "\u65E0 key",
  "local": "\u672C\u5730",
  "subscription": "\u8BA2\u9605",
  "Same as the chain": "\u4E0E\u6A21\u578B\u94FE\u76F8\u540C",
  "Auto-enhance hook model (needs to answer in under 2 s)": "\u81EA\u52A8\u4F18\u5316\u4F7F\u7528\u7684\u6A21\u578B\uFF08\u9700\u5728 2 \u79D2\u5185\u56DE\u7B54\uFF09",
  "File picker model (Max context level)": "\u9009\u6587\u4EF6\u6A21\u578B\uFF08Max \u4E0A\u4E0B\u6587\u7EA7\u522B\uFF09",
  "Balanced": "\u5747\u8861",
  "Concise": "\u7B80\u6D01",
  "Detailed spec": "\u8BE6\u7EC6\u89C4\u683C",
  "Bug fix": "\u4FEE\u590D bug",
  "New feature": "\u65B0\u529F\u80FD",
  "Refactor": "\u91CD\u6784",
  "Code review": "\u4EE3\u7801\u5BA1\u67E5",
  "Plan first": "\u5148\u505A\u8BA1\u5212",
  "Custom only": "\u4EC5\u81EA\u5B9A\u4E49\u6307\u4EE4",
  "Off: prompt only": "\u5173\u95ED\uFF1A\u4EC5\u63D0\u793A\u8BCD",
  "Basic: workspace + agent": "\u57FA\u7840\uFF1A\u5DE5\u4F5C\u533A + agent",
  "Standard: + rules, stack, tree": "\u6807\u51C6\uFF1A+ \u89C4\u5219\u3001\u6280\u672F\u6808\u3001\u76EE\u5F55\u6811",
  "Deep: + git + relevant code": "\u6DF1\u5165\uFF1A+ git + \u76F8\u5173\u4EE3\u7801",
  "Max: + AI-picked files + terminal": "\u6700\u5927\uFF1A+ AI \u9009\u62E9\u7684\u6587\u4EF6 + \u7EC8\u7AEF",
  "Show more": "\u663E\u793A\u66F4\u591A",
  "Press again to clear history": "\u518D\u6309\u4E00\u6B21\u6E05\u7A7A\u5386\u53F2",
  "Auto-enhance (AI) has no model to use": "\u81EA\u52A8\u4F18\u5316\uFF08AI\uFF09\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B",
  "Write a prompt first.": "\u8BF7\u5148\u5199\u63D0\u793A\u8BCD\u3002",
  "Nothing to send.": "\u6CA1\u6709\u53EF\u53D1\u9001\u7684\u5185\u5BB9\u3002",
  "Invalid model profile.": "\u6A21\u578B\u914D\u7F6E\u65E0\u6548\u3002",
  "Unknown profile.": "\u672A\u77E5\u7684\u6A21\u578B\u914D\u7F6E\u3002",
  "{name} \xB7 {model} answered (key: {key}).": "{name} \xB7 {model} \u5DF2\u56DE\u590D\uFF08\u5BC6\u94A5\uFF1A{key}\uFF09\u3002",
  "Invalid API base URL: {url}": "API \u57FA\u7840 URL \u65E0\u6548\uFF1A{url}",
  "The API base URL must use https (http is allowed only for localhost).": "API \u57FA\u7840 URL \u5FC5\u987B\u4F7F\u7528 https\uFF08\u4EC5 localhost \u53EF\u7528 http\uFF09\u3002",
  "Put the API key in the Models tab, not in the URL.": "\u8BF7\u5728\u201C\u6A21\u578B\u201D\u4E2D\u586B\u5199 API \u5BC6\u94A5\uFF0C\u4E0D\u8981\u653E\u5728 URL \u91CC\u3002",
  "The request was cancelled or timed out.": "\u8BF7\u6C42\u5DF2\u53D6\u6D88\u6216\u8D85\u65F6\u3002",
  "{model} did not answer within {seconds} s.": "{model} \u5728 {seconds} \u79D2\u5185\u6CA1\u6709\u56DE\u7B54\u3002",
  "{reason} A lower context level or a faster model answers sooner.": "{reason} \u964D\u4F4E\u4E0A\u4E0B\u6587\u7EA7\u522B\u6216\u6362\u7528\u66F4\u5FEB\u7684\u6A21\u578B\uFF0C\u4F1A\u66F4\u5FEB\u5F97\u5230\u56DE\u7B54\u3002",
  "That run is no longer going (the plugin was restarted). Try again.": "\u90A3\u6B21\u8FD0\u884C\u5DF2\u4E0D\u5B58\u5728\uFF08\u63D2\u4EF6\u5DF2\u91CD\u65B0\u542F\u52A8\uFF09\u3002\u8BF7\u91CD\u8BD5\u3002",
  "{url} stopped answering: {detail}": "{url} \u505C\u6B62\u54CD\u5E94\uFF1A{detail}",
  "{url} did not answer with JSON ({what}). A proxy or sign-in page may be in the way.": "{url} \u8FD4\u56DE\u7684\u4E0D\u662F JSON\uFF08{what}\uFF09\u3002\u53EF\u80FD\u88AB\u4EE3\u7406\u6216\u767B\u5F55\u9875\u62E6\u622A\u3002",
  "an empty answer": "\u7A7A\u54CD\u5E94",
  "No API key. Add one in the Enhance Prompt panel (Models tab).": "\u6CA1\u6709 API \u5BC6\u94A5\u3002\u8BF7\u5728 Enhance Prompt \u9762\u677F\uFF08\u201C\u6A21\u578B\u201D\uFF09\u4E2D\u6DFB\u52A0\u3002",
  "No API key. Add one in the Enhance Prompt panel (Models tab) or set {env}.": "\u6CA1\u6709 API \u5BC6\u94A5\u3002\u8BF7\u5728 Enhance Prompt \u9762\u677F\uFF08\u201C\u6A21\u578B\u201D\uFF09\u4E2D\u6DFB\u52A0\uFF0C\u6216\u8BBE\u7F6E {env}\u3002",
  "Could not reach {url}: {detail}": "\u65E0\u6CD5\u8FDE\u63A5 {url}\uFF1A{detail}",
  "{status}: {detail}": "{status}\uFF1A{detail}",
  "The model returned an empty answer.": "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u56DE\u7B54\u3002",
  "{model} reached its limit of {max} tokens before it finished. Raise Max tokens for this model in the Models tab.": "{model} \u8FD8\u6CA1\u5199\u5B8C\u5C31\u8FBE\u5230\u4E86 {max} \u4E2A token \u7684\u4E0A\u9650\u3002\u8BF7\u5728\u201C\u6A21\u578B\u201D\u6807\u7B7E\u4E2D\u8C03\u9AD8\u8BE5\u6A21\u578B\u7684\u6700\u5927 token\u3002",
  "Unsafe argument for a .cmd launcher.": ".cmd \u542F\u52A8\u5668\u7684\u53C2\u6570\u4E0D\u5B89\u5168\u3002",
  "{name} was not found. Install it and sign in, or set its full path in the model.": "\u672A\u627E\u5230 {name}\u3002\u8BF7\u5B89\u88C5\u5E76\u767B\u5F55\uFF0C\u6216\u5728\u6A21\u578B\u4E2D\u586B\u5199\u5B8C\u6574\u8DEF\u5F84\u3002",
  "Could not start {binary}: {detail}": "\u65E0\u6CD5\u542F\u52A8 {binary}\uFF1A{detail}",
  "{kind} exited with {code}": "{kind} \u9000\u51FA\uFF0C\u4EE3\u7801 {code}",
  "{kind} exited with {code}: {detail}": "{kind} \u9000\u51FA\uFF0C\u4EE3\u7801 {code}\uFF1A{detail}",
  "{text} (run it once in a terminal to sign in)": "{text}\uFF08\u8BF7\u5148\u5728\u7EC8\u7AEF\u8FD0\u884C\u4E00\u6B21\u4EE5\u767B\u5F55\uFF09",
  "{kind} returned an empty answer.": "{kind} \u8FD4\u56DE\u4E86\u7A7A\u56DE\u7B54\u3002",
  "No model configured. Add one in the Models tab.": "\u5C1A\u672A\u914D\u7F6E\u6A21\u578B\u3002\u8BF7\u5728\u201C\u6A21\u578B\u201D\u4E2D\u6DFB\u52A0\u3002",
  "{name}: no API key": "{name}\uFF1A\u6CA1\u6709 API \u5BC6\u94A5",
  "All models failed. {list}": "\u6240\u6709\u6A21\u578B\u90FD\u5931\u8D25\u4E86\u3002{list}",
  "{name}: {reason}": "{name}\uFF1A{reason}",
  "Out of time.": "\u65F6\u95F4\u5DF2\u7528\u5B8C\u3002",
  "Rules": "\u89C4\u5219",
  "Your rules": "\u4F60\u7684\u89C4\u5219",
  "Followed in every enhanced prompt and by auto-enhance, on top of the style. A rule you add is for the project you are in.": "\u5728\u6BCF\u4E2A\u4F18\u5316\u7684\u63D0\u793A\u8BCD\u548C\u81EA\u52A8\u4F18\u5316\u4E2D\u90FD\u4F1A\u9075\u5FAA\uFF0C\u53E0\u52A0\u5728\u98CE\u683C\u4E4B\u4E0A\u3002\u4F60\u6DFB\u52A0\u7684\u89C4\u5219\u53EA\u7528\u4E8E\u4F60\u5F53\u524D\u6240\u5728\u7684\u9879\u76EE\u3002",
  'No rules yet. Example: "Always tell the agent to run pnpm test before finishing."': "\u8FD8\u6CA1\u6709\u89C4\u5219\u3002\u4F8B\u5982\uFF1A\u201C\u59CB\u7EC8\u8BA9 agent \u5728\u5B8C\u6210\u524D\u8FD0\u884C pnpm test\u3002\u201D",
  "Every project": "\u6240\u6709\u9879\u76EE",
  "New rule": "\u65B0\u89C4\u5219",
  "e.g. Answer in Vietnamese; keep code identifiers in English.": "\u4F8B\u5982\uFF1A\u7528\u4E2D\u6587\u5199\uFF1B\u4EE3\u7801\u6807\u8BC6\u7B26\u4FDD\u6301\u82F1\u6587\u3002",
  "Only {name}": "\u4EC5 {name}",
  "Add rule": "\u6DFB\u52A0\u89C4\u5219",
  "Prompt structures": "\u63D0\u793A\u8BCD\u7ED3\u6784",
  "Pick one under Options in the composer: the prompt is written under these headings instead of the style's shape.": "\u5728\u7F16\u8F91\u533A\u7684\u201C\u9009\u9879\u201D\u4E2D\u9009\u62E9\uFF1A\u63D0\u793A\u8BCD\u5C06\u6309\u8FD9\u4E9B\u6807\u9898\u6765\u5199\uFF0C\u4EE3\u66FF\u98CE\u683C\u81EA\u5E26\u7684\u683C\u5F0F\u3002",
  "built-in": "\u5185\u7F6E",
  "Structure name": "\u7ED3\u6784\u540D\u79F0",
  "e.g. My brief": "\u4F8B\u5982\uFF1A\u6211\u7684\u7B80\u62A5",
  "Headings, one per line": "\u6807\u9898\uFF0C\u6BCF\u884C\u4E00\u4E2A",
  "Written in any language; the rewriter translates them into the output language.": "\u53EF\u7528\u4EFB\u4F55\u8BED\u8A00\u4E66\u5199\uFF1B\u6539\u5199\u65F6\u4F1A\u8BD1\u6210\u8F93\u51FA\u8BED\u8A00\u3002",
  "Add structure": "\u6DFB\u52A0\u7ED3\u6784",
  "Structure": "\u7ED3\u6784",
  "By style": "\u6309\u98CE\u683C",
  "Task brief": "\u4EFB\u52A1\u7B80\u62A5",
  "Steps": "\u6B65\u9AA4",
  "Goal": "\u76EE\u6807",
  "Requirements": "\u8981\u6C42",
  "Constraints / out of scope": "\u7EA6\u675F / \u4E0D\u5728\u8303\u56F4\u5185",
  "Edge cases": "\u8FB9\u754C\u60C5\u51B5",
  "Acceptance criteria": "\u9A8C\u6536\u6807\u51C6",
  "Assumptions / questions": "\u5047\u8BBE / \u95EE\u9898",
  "Verify": "\u9A8C\u8BC1",
  "Background": "\u80CC\u666F",
  "everywhere": "\u5168\u90E8",
  "The enhanced prompt is kept for {name}: go back to that project to send it.": "\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\u5DF2\u4E3A {name} \u4FDD\u7559\uFF1A\u56DE\u5230\u8BE5\u9879\u76EE\u518D\u53D1\u9001\u3002",
  "The project this prompt was written for is closed, so its enhanced prompt was dropped.": "\u5199\u8FD9\u4E2A\u63D0\u793A\u8BCD\u7684\u9879\u76EE\u5DF2\u5173\u95ED\uFF0C\u56E0\u6B64\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\u5DF2\u4E22\u5F03\u3002",
  "Writing the prompt for {name}\u2026": "\u6B63\u5728\u4E3A {name} \u5199\u63D0\u793A\u8BCD\u2026",
  "Feedback": "\u53CD\u9988",
  "Found a bug, or something that could be better? Open an issue on GitHub: it is how the plugin gets fixed and improved.": "\u53D1\u73B0\u4E86 bug\uFF0C\u6216\u89C9\u5F97\u54EA\u91CC\u53EF\u4EE5\u66F4\u597D\uFF1F\u8BF7\u5728 GitHub \u4E0A\u63D0 issue\uFF1A\u63D2\u4EF6\u5C31\u662F\u8FD9\u6837\u88AB\u4FEE\u590D\u548C\u6539\u8FDB\u7684\u3002",
  "Open an issue on GitHub": "\u5728 GitHub \u4E0A\u63D0 issue",
  "Open {url} in your browser.": "\u8BF7\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00 {url}\u3002",
  "Got an idea, or something that could work better? Send your feedback: it is how the plugin improves.": "\u6709\u65B0\u60F3\u6CD5\uFF0C\u6216\u8005\u89C9\u5F97\u54EA\u91CC\u53EF\u4EE5\u66F4\u597D\uFF1F\u6B22\u8FCE\u53CD\u9988\uFF1A\u63D2\u4EF6\u5C31\u662F\u8FD9\u6837\u4E0D\u65AD\u6539\u8FDB\u7684\u3002",
  "Send feedback": "\u53D1\u9001\u53CD\u9988",
  "Don't ask again": "\u4E0D\u518D\u8BE2\u95EE",
  "No more feedback notes. To turn them back on, open the gear icon and look under Feedback.": "\u4E0D\u4F1A\u518D\u663E\u793A\u53CD\u9988\u63D0\u793A\u3002\u8981\u91CD\u65B0\u5F00\u542F\uFF0C\u8BF7\u70B9\u51FB\u9F7F\u8F6E\u56FE\u6807\uFF0C\u5728\u201C\u53CD\u9988\u201D\u4E00\u680F\u4E2D\u8BBE\u7F6E\u3002",
  "Ask for feedback now and then": "\u5076\u5C14\u9080\u8BF7\u53CD\u9988",
  "A short note under the enhanced prompt invites your ideas, at most once in {days} days. Off: it never shows.": "\u5728\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\u4E0B\u65B9\u663E\u793A\u4E00\u6761\u7B80\u77ED\u63D0\u793A\uFF0C\u9080\u8BF7\u4F60\u63D0\u51FA\u60F3\u6CD5\uFF0C\u6700\u591A\u6BCF {days} \u5929\u4E00\u6B21\u3002\u5173\u95ED\u540E\u4E0D\u518D\u663E\u793A\u3002",
  "Progress: {percent}%": "\u8FDB\u5EA6\uFF1A{percent}%",
  "{name} is {size}; an image can be at most {max}.": "{name} \u5927\u5C0F\u4E3A {size}\uFF1B\u6BCF\u5F20\u56FE\u7247\u6700\u591A {max}\u3002",
  "This model cannot see images: it got their paths only, and the prompt lists them for the agent.": "\u8BE5\u6A21\u578B\u770B\u4E0D\u5230\u56FE\u7247\uFF1A\u5B83\u53EA\u6536\u5230\u8DEF\u5F84\uFF0C\u63D0\u793A\u8BCD\u4F1A\u4E3A agent \u5217\u51FA\u8FD9\u4E9B\u56FE\u7247\u3002",
  "Remove {name}": "\u79FB\u9664 {name}",
  "Finishing\u2026": "\u5373\u5C06\u5B8C\u6210\u2026",
  "Which folder is this project?": "\u8FD9\u4E2A\u9879\u76EE\u5728\u54EA\u4E2A\u6587\u4EF6\u5939\uFF1F",
  "Several projects are named {name} on the same branch. Pick its folder so its files are read and its rules are followed.": "\u6709\u591A\u4E2A\u9879\u76EE\u5728\u540C\u4E00\u5206\u652F\u4E0A\u90FD\u53EB {name}\u3002\u8BF7\u9009\u62E9\u5B83\u7684\u6587\u4EF6\u5939\uFF0C\u4EE5\u4FBF\u8BFB\u53D6\u5B83\u7684\u6587\u4EF6\u5E76\u9075\u5FAA\u5B83\u7684\u89C4\u5219\u3002",
  "Project folder": "\u9879\u76EE\u6587\u4EF6\u5939",
  "Choose a folder": "\u9009\u62E9\u6587\u4EF6\u5939",
  "That attachment could not be received; try attaching it again.": "\u672A\u80FD\u63A5\u6536\u8BE5\u9644\u4EF6\uFF0C\u8BF7\u91CD\u65B0\u9644\u52A0\u3002",
  "The attached file {name} is no longer there (attachments are kept for a day). Attach it again.": "\u9644\u4EF6 {name} \u5DF2\u4E0D\u5B58\u5728\uFF08\u9644\u4EF6\u53EA\u4FDD\u7559\u4E00\u5929\uFF09\u3002\u8BF7\u91CD\u65B0\u9644\u52A0\u3002",
  "{name} is {size}; an attachment can be at most {max}.": "{name} \u5927\u5C0F\u4E3A {size}\uFF1B\u6BCF\u4E2A\u9644\u4EF6\u6700\u591A {max}\u3002",
  "At most {max} files per prompt.": "\u6BCF\u4E2A\u63D0\u793A\u6700\u591A {max} \u4E2A\u6587\u4EF6\u3002",
  "Drop files to attach": "\u62D6\u653E\u6587\u4EF6\u4EE5\u9644\u52A0",
  "Attach files": "\u9644\u52A0\u6587\u4EF6",
  "Add": "\u6DFB\u52A0",
  "Move up": "\u4E0A\u79FB",
  "Move down": "\u4E0B\u79FB",
  "More": "\u66F4\u591A",
  "edited": "\u5DF2\u4FEE\u6539",
  "Restore the default": "\u6062\u590D\u9ED8\u8BA4",
  "Custom instructions": "\u81EA\u5B9A\u4E49\u6307\u4EE4",
  "e.g. Write the prompt as a numbered checklist; always ask the agent to run the tests.": "\u4F8B\u5982\uFF1A\u628A\u63D0\u793A\u5199\u6210\u7F16\u53F7\u6E05\u5355\uFF1B\u603B\u662F\u8981\u6C42\u4EE3\u7406\u8FD0\u884C\u6D4B\u8BD5\u3002",
  "What's new": "\u65B0\u529F\u80FD",
  "What's new in {version}": "{version} \u65B0\u529F\u80FD",
  "Changelog": "\u66F4\u65B0\u65E5\u5FD7",
  "agents": "\u4EE3\u7406",
  "agent session": "\u4EE3\u7406\u4F1A\u8BDD",
  "{count} agents": "{count} \u4E2A\u4EE3\u7406",
  "Reading other agents' sessions": "\u8BFB\u53D6\u5176\u4ED6\u4EE3\u7406\u7684\u4F1A\u8BDD",
  "Read other agents' sessions": "\u8BFB\u53D6\u5176\u4ED6\u4EE3\u7406\u7684\u4F1A\u8BDD",
  "At the Max level: the other agents running in this workspace (kind, title, state) and the last lines of their terminals, with keys and passwords masked. Needs Read terminal output too. Off until you turn it on.": "\u5728\u201C\u6700\u5927\u201D\u7EA7\u522B\uFF1A\u6B64\u5DE5\u4F5C\u533A\u4E2D\u6B63\u5728\u8FD0\u884C\u7684\u5176\u4ED6\u4EE3\u7406\uFF08\u7C7B\u578B\u3001\u6807\u9898\u3001\u72B6\u6001\uFF09\u53CA\u5176\u7EC8\u7AEF\u7684\u6700\u540E\u51E0\u884C\uFF0C\u5BC6\u94A5\u548C\u5BC6\u7801\u4F1A\u88AB\u906E\u76D6\u3002\u8FD8\u9700\u8981\u5F00\u542F\u201C\u8BFB\u53D6\u7EC8\u7AEF\u8F93\u51FA\u201D\u3002\u9ED8\u8BA4\u5173\u95ED\uFF0C\u76F4\u5230\u4F60\u6253\u5F00\u3002",
  "Other agents in this workspace": "\u6B64\u5DE5\u4F5C\u533A\u4E2D\u7684\u5176\u4ED6\u4EE3\u7406",
  "Other agent session: {name}": "\u5176\u4ED6\u4EE3\u7406\u4F1A\u8BDD\uFF1A{name}",
  "Open in Copilot": "\u5728 Copilot \u4E2D\u6253\u5F00",
  "Or start a new agent": "\u6216\u542F\u52A8\u65B0\u4EE3\u7406",
  "Agent": "\u4EE3\u7406",
  "Start": "\u542F\u52A8",
  'Turn on "{name}"?': "\u5F00\u542F\u201C{name}\u201D\uFF1F",
  "Read what this allows. Nothing is hidden: this is everything it does.": "\u8BF7\u9605\u8BFB\u6B64\u9879\u5141\u8BB8\u7684\u5185\u5BB9\u3002\u6CA1\u6709\u4EFB\u4F55\u9690\u7792\uFF1A\u8FD9\u5C31\u662F\u5B83\u6240\u505A\u7684\u5168\u90E8\u3002",
  "You can turn it off at any time here; turning it off also withdraws this confirmation.": "\u4F60\u53EF\u4EE5\u968F\u65F6\u5728\u8FD9\u91CC\u5173\u95ED\uFF1B\u5173\u95ED\u7684\u540C\u65F6\u4E5F\u4F1A\u64A4\u56DE\u6B64\u786E\u8BA4\u3002",
  "I understand, turn it on": "\u6211\u5DF2\u4E86\u89E3\uFF0C\u5F00\u542F",
  "asks to confirm": "\u9700\u786E\u8BA4",
  "Turned on in Settings, but not confirmed here yet: still off.": "\u5DF2\u5728\u8BBE\u7F6E\u4E2D\u5F00\u542F\uFF0C\u4F46\u5C1A\u672A\u5728\u6B64\u786E\u8BA4\uFF1A\u4ECD\u4E3A\u5173\u95ED\u3002",
  "Read and confirm": "\u9605\u8BFB\u5E76\u786E\u8BA4",
  "Notifications": "\u901A\u77E5",
  "Notify when a long enhance finishes": "\u957F\u65F6\u95F4\u4F18\u5316\u5B8C\u6210\u65F6\u901A\u77E5",
  "Watch what agents do": "\u5173\u6CE8\u4EE3\u7406\u7684\u64CD\u4F5C",
  "Deep and Max levels: each tool an agent runs in Copilot (its name and its target: a file path or a command, never its output) and how sessions end. Kept in memory for 45 minutes, never saved to disk.": "\u201C\u6DF1\u5165\u201D\u548C\u201C\u6700\u5927\u201D\u7EA7\u522B\uFF1A\u4EE3\u7406\u5728 Copilot \u4E2D\u8FD0\u884C\u7684\u6BCF\u4E2A\u5DE5\u5177\uFF08\u540D\u79F0\u53CA\u5176\u5BF9\u8C61\uFF1A\u6587\u4EF6\u8DEF\u5F84\u6216\u547D\u4EE4\uFF0C\u7EDD\u4E0D\u5305\u542B\u8F93\u51FA\uFF09\u4EE5\u53CA\u4F1A\u8BDD\u5982\u4F55\u7ED3\u675F\u3002\u53EA\u5728\u5185\u5B58\u4E2D\u4FDD\u7559 45 \u5206\u949F\uFF0C\u7EDD\u4E0D\u5199\u5165\u78C1\u76D8\u3002",
  "Notice files you save": "\u8BB0\u5F55\u4F60\u4FDD\u5B58\u7684\u6587\u4EF6",
  "Deep and Max levels: the paths of files you save in Copilot's editor (never their text), kept in memory for 45 minutes; they rank first in the code search.": "\u201C\u6DF1\u5165\u201D\u548C\u201C\u6700\u5927\u201D\u7EA7\u522B\uFF1A\u4F60\u5728 Copilot \u7F16\u8F91\u5668\u4E2D\u4FDD\u5B58\u7684\u6587\u4EF6\u8DEF\u5F84\uFF08\u7EDD\u4E0D\u5305\u542B\u5176\u5185\u5BB9\uFF09\uFF0C\u5728\u5185\u5B58\u4E2D\u4FDD\u7559 45 \u5206\u949F\uFF1B\u4EE3\u7801\u641C\u7D22\u65F6\u4F18\u5148\u8003\u8651\u5B83\u4EEC\u3002",
  "Start new agents": "\u542F\u52A8\u65B0\u4EE3\u7406",
  "A button that starts a new agent (Claude Code, Codex\u2026) in this workspace with the enhanced prompt, only when you press it.": "\u4E00\u4E2A\u6309\u94AE\uFF0C\u5728\u6B64\u5DE5\u4F5C\u533A\u7528\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\u542F\u52A8\u65B0\u4EE3\u7406\uFF08Claude Code\u3001Codex\u2026\uFF09\uFF0C\u4EC5\u5728\u4F60\u6309\u4E0B\u65F6\u3002",
  "Open files in Copilot": "\u5728 Copilot \u4E2D\u6253\u5F00\u6587\u4EF6",
  "Clicking a file in the context list opens it in an editor tab.": "\u70B9\u51FB\u4E0A\u4E0B\u6587\u5217\u8868\u4E2D\u7684\u6587\u4EF6\u4F1A\u5728\u7F16\u8F91\u5668\u6807\u7B7E\u9875\u4E2D\u6253\u5F00\u5B83\u3002",
  "That text is sent with your prompt to the model you run (your API provider, or the subscription CLI and its provider). It can contain code, file contents, command output and anything the agents printed.": "\u8FD9\u4E9B\u6587\u672C\u4F1A\u968F\u63D0\u793A\u8BCD\u53D1\u9001\u7ED9\u4F60\u8FD0\u884C\u7684\u6A21\u578B\uFF08\u4F60\u7684 API \u63D0\u4F9B\u5546\uFF0C\u6216\u8BA2\u9605 CLI \u53CA\u5176\u63D0\u4F9B\u5546\uFF09\u3002\u5176\u4E2D\u53EF\u80FD\u5305\u542B\u4EE3\u7801\u3001\u6587\u4EF6\u5185\u5BB9\u3001\u547D\u4EE4\u8F93\u51FA\u4EE5\u53CA\u4EE3\u7406\u6253\u5370\u7684\u4EFB\u4F55\u5185\u5BB9\u3002",
  "Values that look like keys, tokens or passwords are masked first, but masking cannot catch everything.": "\u770B\u8D77\u6765\u50CF\u5BC6\u94A5\u3001\u4EE4\u724C\u6216\u5BC6\u7801\u7684\u503C\u4F1A\u5148\u88AB\u906E\u76D6\uFF0C\u4F46\u906E\u76D6\u65E0\u6CD5\u8986\u76D6\u6240\u6709\u60C5\u51B5\u3002",
  "Nothing of it is saved by the plugin. You can untick it in the context list for one run, or turn this switch off at any time.": "\u63D2\u4EF6\u4E0D\u4F1A\u4FDD\u5B58\u5176\u4E2D\u4EFB\u4F55\u5185\u5BB9\u3002\u4F60\u53EF\u4EE5\u5728\u4E0A\u4E0B\u6587\u5217\u8868\u4E2D\u4E3A\u67D0\u6B21\u8FD0\u884C\u53D6\u6D88\u52FE\u9009\uFF0C\u6216\u968F\u65F6\u5173\u95ED\u6B64\u5F00\u5173\u3002",
  "Copilot tells the plugin each tool an agent runs in its terminals: the tool name and what it acted on (a file path, a command line, a search pattern or a URL), never the tool's output. Copilot also tells it when a session finishes and how.": "Copilot \u4F1A\u544A\u8BC9\u63D2\u4EF6\u4EE3\u7406\u5728\u7EC8\u7AEF\u4E2D\u8FD0\u884C\u7684\u6BCF\u4E2A\u5DE5\u5177\uFF1A\u5DE5\u5177\u540D\u79F0\u53CA\u5176\u4F5C\u7528\u5BF9\u8C61\uFF08\u6587\u4EF6\u8DEF\u5F84\u3001\u547D\u4EE4\u884C\u3001\u641C\u7D22\u6A21\u5F0F\u6216 URL\uFF09\uFF0C\u7EDD\u4E0D\u5305\u542B\u5DE5\u5177\u7684\u8F93\u51FA\u3002Copilot \u4E5F\u4F1A\u544A\u8BC9\u63D2\u4EF6\u4F1A\u8BDD\u4F55\u65F6\u7ED3\u675F\u4EE5\u53CA\u7ED3\u679C\u5982\u4F55\u3002",
  "This is kept in the plugin's memory only, for 45 minutes and 60 entries per workspace, and forgotten when you turn this off, delete everything, or Copilot restarts.": "\u8FD9\u4E9B\u4FE1\u606F\u53EA\u4FDD\u5B58\u5728\u63D2\u4EF6\u7684\u5185\u5B58\u4E2D\uFF0C\u6BCF\u4E2A\u5DE5\u4F5C\u533A\u6700\u591A 45 \u5206\u949F\u300160 \u6761\uFF0C\u5728\u4F60\u5173\u95ED\u6B64\u9879\u3001\u5220\u9664\u5168\u90E8\u6216 Copilot \u91CD\u542F\u65F6\u88AB\u6E05\u9664\u3002",
  "At the Deep and Max levels, the recent entries of the focused workspace are sent with your prompt to the model you run. Command lines are masked for obvious keys and passwords.": "\u5728\u201C\u6DF1\u5165\u201D\u548C\u201C\u6700\u5927\u201D\u7EA7\u522B\uFF0C\u5F53\u524D\u5DE5\u4F5C\u533A\u7684\u8FD1\u671F\u8BB0\u5F55\u4F1A\u968F\u63D0\u793A\u8BCD\u53D1\u9001\u7ED9\u4F60\u8FD0\u884C\u7684\u6A21\u578B\u3002\u547D\u4EE4\u884C\u4E2D\u660E\u663E\u7684\u5BC6\u94A5\u548C\u5BC6\u7801\u4F1A\u88AB\u906E\u76D6\u3002",
  "The plugin only watches: it never changes or blocks what an agent does.": "\u63D2\u4EF6\u53EA\u89C2\u5BDF\uFF1A\u7EDD\u4E0D\u66F4\u6539\u6216\u963B\u6B62\u4EE3\u7406\u7684\u64CD\u4F5C\u3002",
  "Adds a button that starts a new agent (Claude Code, Codex, Gemini\u2026) in a new terminal of this workspace, and types the enhanced prompt into it once it is ready.": "\u6DFB\u52A0\u4E00\u4E2A\u6309\u94AE\uFF0C\u5728\u6B64\u5DE5\u4F5C\u533A\u7684\u65B0\u7EC8\u7AEF\u4E2D\u542F\u52A8\u65B0\u4EE3\u7406\uFF08Claude Code\u3001Codex\u3001Gemini\u2026\uFF09\uFF0C\u5E76\u5728\u5176\u5C31\u7EEA\u540E\u8F93\u5165\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\u3002",
  "The agent runs with your user account, exactly as if you had opened it yourself: it can read and change files and run commands, within that agent's own permission settings.": "\u4EE3\u7406\u4EE5\u4F60\u7684\u7528\u6237\u8D26\u6237\u8FD0\u884C\uFF0C\u4E0E\u4F60\u4EB2\u81EA\u6253\u5F00\u5B8C\u5168\u76F8\u540C\uFF1A\u5B83\u53EF\u4EE5\u5728\u8BE5\u4EE3\u7406\u81EA\u8EAB\u7684\u6743\u9650\u8BBE\u7F6E\u8303\u56F4\u5185\u8BFB\u53D6\u548C\u4FEE\u6539\u6587\u4EF6\u3001\u8FD0\u884C\u547D\u4EE4\u3002",
  "It only happens when you press the button. The plugin never starts an agent by itself.": "\u53EA\u6709\u5728\u4F60\u6309\u4E0B\u6309\u94AE\u65F6\u624D\u4F1A\u53D1\u751F\u3002\u63D2\u4EF6\u7EDD\u4E0D\u4F1A\u81EA\u884C\u542F\u52A8\u4EE3\u7406\u3002",
  "Enhanced prompt ready ({model}, {seconds} s)": "\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\u5DF2\u5C31\u7EEA\uFF08{model}\uFF0C{seconds} \u79D2\uFF09",
  "Started a new {agent} agent with the prompt.": "\u5DF2\u7528\u63D0\u793A\u8BCD\u542F\u52A8\u65B0\u7684 {agent} \u4EE3\u7406\u3002",
  "Recent agent activity": "\u4EE3\u7406\u7684\u8FD1\u671F\u6D3B\u52A8",
  "Files you saved lately": "\u4F60\u6700\u8FD1\u4FDD\u5B58\u7684\u6587\u4EF6",
  "activity": "\u6D3B\u52A8",
  "saved files": "\u5DF2\u4FDD\u5B58\u7684\u6587\u4EF6",
  "Starting new agents is off in Settings, or not confirmed yet.": "\u201C\u8BBE\u7F6E\u201D\u4E2D\u5DF2\u5173\u95ED\u542F\u52A8\u65B0\u4EE3\u7406\uFF0C\u6216\u5C1A\u672A\u786E\u8BA4\u3002",
  "Opening files in Copilot is off in Settings.": "\u201C\u8BBE\u7F6E\u201D\u4E2D\u5DF2\u5173\u95ED\u5728 Copilot \u4E2D\u6253\u5F00\u6587\u4EF6\u3002",
  "online model lists are off in Settings": "\u201C\u8BBE\u7F6E\u201D\u4E2D\u5DF2\u5173\u95ED\u5728\u7EBF\u6A21\u578B\u5217\u8868",
  "Copilot could not store the API key: this machine has no key store for it. Use a key from an environment variable, or a subscription CLI.": "Copilot \u65E0\u6CD5\u4FDD\u5B58 API key\uFF1A\u8FD9\u53F0\u673A\u5668\u6CA1\u6709\u53EF\u7528\u7684\u5BC6\u94A5\u5B58\u50A8\u3002\u8BF7\u6539\u7528\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 key\uFF0C\u6216\u8BA2\u9605 CLI\u3002",
  "{name} is waiting for an answer from you, and what is typed now could be taken as that answer.": "{name} \u6B63\u5728\u7B49\u4F60\u56DE\u7B54\uFF0C\u73B0\u5728\u8F93\u5165\u7684\u5185\u5BB9\u53EF\u80FD\u4F1A\u88AB\u5F53\u4F5C\u56DE\u7B54\u3002",
  "The model returned no prompt.": "\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u63D0\u793A\u8BCD\u3002",
  "This version of Copilot cannot do that yet.": "\u6B64\u7248\u672C\u7684 Copilot \u8FD8\u4E0D\u652F\u6301\u6B64\u64CD\u4F5C\u3002",
  "Invalid request.": "\u65E0\u6548\u7684\u8BF7\u6C42\u3002",
  "Reads which other agents run in this workspace (kind, title, state) and the last lines of each one's terminal, every time you enhance at the Max level: as many agents and lines as you set below the switch (4 agents and 80 lines by default, at most 8 and 300).": "\u6BCF\u6B21\u4EE5\u201C\u6700\u5927\u201D\u7EA7\u522B\u4F18\u5316\u65F6\uFF0C\u8BFB\u53D6\u6B64\u5DE5\u4F5C\u533A\u4E2D\u8FD0\u884C\u7684\u5176\u4ED6\u4EE3\u7406\uFF08\u7C7B\u578B\u3001\u6807\u9898\u3001\u72B6\u6001\uFF09\u4EE5\u53CA\u6BCF\u4E2A\u4EE3\u7406\u7EC8\u7AEF\u7684\u6700\u540E\u51E0\u884C\uFF1A\u4EE3\u7406\u6570\u548C\u884C\u6570\u6309\u5F00\u5173\u4E0B\u65B9\u7684\u8BBE\u7F6E\uFF08\u9ED8\u8BA4 4 \u4E2A\u4EE3\u7406\u300180 \u884C\uFF0C\u6700\u591A 8 \u4E2A\u548C 300 \u884C\uFF09\u3002",
  "Agents read": "\u8BFB\u53D6\u7684\u4EE3\u7406\u6570",
  "Lines per agent": "\u6BCF\u4E2A\u4EE3\u7406\u7684\u884C\u6570",
  "Used only while this switch is on and confirmed.": "\u4EC5\u5728\u6B64\u5F00\u5173\u5F00\u542F\u5E76\u5DF2\u786E\u8BA4\u65F6\u4F7F\u7528\u3002",
  "{model} declined this request ({category}). Use another model, or rephrase the request.": "{model} \u62D2\u7EDD\u4E86\u6B64\u8BF7\u6C42\uFF08{category}\uFF09\u3002\u8BF7\u6362\u7528\u5176\u4ED6\u6A21\u578B\uFF0C\u6216\u6539\u5199\u8BF7\u6C42\u3002",
  "Send right after enhancing": "\u4F18\u5316\u540E\u76F4\u63A5\u53D1\u9001",
  "On for small, low-risk requests, with an agent that asks before it does anything hard to undo. Leave it off when the agent runs with wide permissions, or when a wrong instruction would be costly.": "\u9002\u5408\u5C0F\u800C\u4F4E\u98CE\u9669\u7684\u8BF7\u6C42\uFF0C\u4E14\u4EE3\u7406\u5728\u505A\u96BE\u4EE5\u64A4\u9500\u7684\u4E8B\u4E4B\u524D\u4F1A\u5148\u8BE2\u95EE\u3002\u5F53\u4EE3\u7406\u6743\u9650\u5F88\u5927\uFF0C\u6216\u4E00\u6761\u9519\u8BEF\u6307\u4EE4\u4EE3\u4EF7\u5F88\u9AD8\u65F6\uFF0C\u8BF7\u4FDD\u6301\u5173\u95ED\u3002",
  "Whenever one of these does not hold, nothing is sent: the result stays in the composer with a note that says why, and you send it yourself.": "\u53EA\u8981\u6709\u4E00\u6761\u4E0D\u6210\u7ACB\uFF0C\u5C31\u4EC0\u4E48\u90FD\u4E0D\u53D1\u9001\uFF1A\u7ED3\u679C\u7559\u5728\u8F93\u5165\u6846\u4E2D\uFF0C\u5E76\u9644\u4E00\u6761\u8BF4\u660E\u539F\u56E0\u7684\u63D0\u793A\uFF0C\u7531\u4F60\u81EA\u5DF1\u53D1\u9001\u3002",
  "Enhance and send without reading (Ctrl+Enter)": "\u4F18\u5316\u540E\u76F4\u63A5\u53D1\u9001\uFF0C\u4E0D\u5148\u67E5\u770B\uFF08Ctrl+Enter\uFF09",
  "Not sent by itself.": "\u672A\u81EA\u52A8\u53D1\u9001\u3002",
  "Read the prompt and send it yourself.": "\u8BF7\u9605\u8BFB\u63D0\u793A\u8BCD\u540E\u81EA\u884C\u53D1\u9001\u3002",
  "Copilot could not tell which project this is.": "Copilot \u65E0\u6CD5\u786E\u5B9A\u8FD9\u662F\u54EA\u4E2A\u9879\u76EE\u3002",
  "The project in focus changed while it ran; the prompt waits in the project it was written in.": "\u8FD0\u884C\u671F\u95F4\u5F53\u524D\u9879\u76EE\u53D1\u751F\u4E86\u53D8\u5316\uFF1B\u63D0\u793A\u8BCD\u4FDD\u7559\u5728\u7F16\u5199\u5B83\u7684\u9879\u76EE\u4E2D\u3002",
  "The terminal picked when you started is closed or no longer the one picked.": "\u5F00\u59CB\u65F6\u9009\u7684\u7EC8\u7AEF\u5DF2\u5173\u95ED\uFF0C\u6216\u5DF2\u4E0D\u518D\u662F\u6240\u9009\u7EC8\u7AEF\u3002",
  "{label} is a plain terminal, not an agent.": "{label} \u662F\u666E\u901A\u7EC8\u7AEF\uFF0C\u4E0D\u662F\u4EE3\u7406\u3002",
  "The text changed while it ran.": "\u8FD0\u884C\u671F\u95F4\u6587\u672C\u53D1\u751F\u4E86\u53D8\u5316\u3002",
  "Saved as a file.": "\u5DF2\u4FDD\u5B58\u4E3A\u6587\u4EF6\u3002",
  "The file could not be saved.": "\u6587\u4EF6\u672A\u80FD\u4FDD\u5B58\u3002",
  "Save as a file": "\u4FDD\u5B58\u4E3A\u6587\u4EF6",
  "Saved {when} \xB7 {count} prompts": "\u4FDD\u5B58\u4E8E {when} \xB7 {count} \u6761\u63D0\u793A\u8BCD",
  "{name} is still working.": "{name} \u4ECD\u5728\u5DE5\u4F5C\u3002",
  "{name} is waiting for an answer from you.": "{name} \u6B63\u5728\u7B49\u4F60\u56DE\u7B54\u3002",
  "Copilot does not say whether {name} is idle.": "Copilot \u6CA1\u6709\u8BF4\u660E {name} \u662F\u5426\u7A7A\u95F2\u3002",
  "Copilot session unavailable": "Copilot \u4F1A\u8BDD\u4E0D\u53EF\u7528",
  "Attached Copilot session": "\u5DF2\u8FDE\u63A5\u7684 Copilot \u4F1A\u8BDD",
  "Send to Copilot (Ctrl+Enter)": "\u53D1\u9001\u5230 Copilot (Ctrl+Enter)",
  "Prompt preferences": "\u63D0\u793A\u8BCD\u504F\u597D",
  "Default style": "\u9ED8\u8BA4\u98CE\u683C",
  "Default context level": "\u9ED8\u8BA4\u4E0A\u4E0B\u6587\u7EA7\u522B",
  "Default output language": "\u9ED8\u8BA4\u8F93\u51FA\u8BED\u8A00",
  "Additional context files": "\u9644\u52A0\u4E0A\u4E0B\u6587\u6587\u4EF6",
  "Excluded paths": "\u6392\u9664\u7684\u8DEF\u5F84",
  "Timeout per model (seconds)": "\u6BCF\u4E2A\u6A21\u578B\u7684\u8D85\u65F6\uFF08\u79D2\uFF09",
  "History limit": "\u5386\u53F2\u8BB0\u5F55\u4E0A\u9650",
  "Adapt instructions to Copilot": "\u9488\u5BF9 Copilot \u8C03\u6574\u6307\u4EE4",
  "Auto-enhance appended text": "\u81EA\u52A8\u589E\u5F3A\u9644\u52A0\u6587\u672C",
  "Auto-enhance minimum characters": "\u81EA\u52A8\u589E\u5F3A\u6700\u5C11\u5B57\u7B26\u6570",
  "Include context in auto-enhance": "\u81EA\u52A8\u589E\u5F3A\u65F6\u5305\u542B\u4E0A\u4E0B\u6587",
  'It does nothing while "Send to Copilot" is off.': "\u5173\u95ED\u201C\u53D1\u9001\u5230 Copilot\u201D\u65F6\u4E0D\u8D77\u4F5C\u7528\u3002",
  "Auto-enhance Copilot session prompts": "\u81EA\u52A8\u589E\u5F3A Copilot \u4F1A\u8BDD\u63D0\u793A\u8BCD",
  "These switches control what Enhance Prompt reads, sends and stores. They are checked for every run.": "\u8FD9\u4E9B\u5F00\u5173\u63A7\u5236 Enhance Prompt \u8BFB\u53D6\u3001\u53D1\u9001\u548C\u4FDD\u5B58\u7684\u5185\u5BB9\u3002\u6BCF\u6B21\u8FD0\u884C\u90FD\u4F1A\u68C0\u67E5\u3002",
  "Unavailable in Copilot": "Copilot \u4E2D\u4E0D\u53EF\u7528",
  "The current canvas SDK does not provide this capability.": "\u5F53\u524D\u753B\u5E03 SDK \u4E0D\u63D0\u4F9B\u6B64\u529F\u80FD\u3002",
  "API keys (protected by Windows)": "API \u5BC6\u94A5\uFF08\u7531 Windows \u4FDD\u62A4\uFF09",
  "Copilot prompts are left unchanged.": "\u4FDD\u7559 Copilot \u63D0\u793A\u8BCD\u539F\u6587\u3002",
  "Appends the text from Prompt preferences when Copilot invokes the prompt hook. No model call.": "Copilot \u8C03\u7528\u63D0\u793A\u8BCD\u94A9\u5B50\u65F6\uFF0C\u9644\u52A0\u63D0\u793A\u8BCD\u504F\u597D\u4E2D\u7684\u6587\u672C\u3002\u4E0D\u8C03\u7528\u6A21\u578B\u3002",
  "A fast API model rewrites hooked prompts with a two-second budget. Failures preserve the original. Prompts sent from this panel are skipped.": "\u5FEB\u901F API \u6A21\u578B\u5728\u4E24\u79D2\u5185\u91CD\u5199\u63D0\u793A\u8BCD\u3002\u5931\u8D25\u65F6\u4FDD\u7559\u539F\u6587\u3002\u8DF3\u8FC7\u4ECE\u6B64\u9762\u677F\u53D1\u9001\u7684\u63D0\u793A\u8BCD\u3002",
  "Send to Copilot": "\u53D1\u9001\u5230 Copilot",
  "Send a new message to the attached Copilot session when you click Send. Off: use Copy instead.": "\u70B9\u51FB\u53D1\u9001\uFF0C\u5C06\u65B0\u6D88\u606F\u53D1\u9001\u5230\u5DF2\u8FDE\u63A5\u7684 Copilot \u4F1A\u8BDD\u3002\u5173\u95ED\u65F6\u53EF\u4F7F\u7528\u590D\u5236\u3002",
  "Send starts a new Copilot turn. Busy, blocked, disconnected and unknown sessions refuse the message.": "\u53D1\u9001\u4F1A\u5F00\u59CB\u65B0\u7684 Copilot \u8F6E\u6B21\u3002\u5FD9\u788C\u3001\u7B49\u5F85\u786E\u8BA4\u3001\u65AD\u5F00\u8FDE\u63A5\u6216\u72B6\u6001\u672A\u77E5\u7684\u4F1A\u8BDD\u4F1A\u62D2\u7EDD\u6D88\u606F\u3002",
  "Prompts, results and context are saved as plain text in the plugin data folder. Drafts are separated by Copilot session.": "\u63D0\u793A\u8BCD\u3001\u7ED3\u679C\u548C\u4E0A\u4E0B\u6587\u4EE5\u7EAF\u6587\u672C\u4FDD\u5B58\u5728\u63D2\u4EF6\u6570\u636E\u76EE\u5F55\u4E2D\u3002\u8349\u7A3F\u6309 Copilot \u4F1A\u8BDD\u9694\u79BB\u3002",
  "Ctrl+Enter, or the button next to Enhance, enhances and sends a new Copilot message without review. Enter alone stops at the result. Off until you turn it on.": "Ctrl+Enter \u6216\u589E\u5F3A\u65C1\u8FB9\u7684\u6309\u94AE\u4F1A\u589E\u5F3A\u5E76\u76F4\u63A5\u53D1\u9001\u65B0\u7684 Copilot \u6D88\u606F\uFF0C\u65E0\u9700\u5BA1\u9605\u3002\u5355\u72EC\u6309 Enter \u53EA\u751F\u6210\u7ED3\u679C\u3002\u9ED8\u8BA4\u5173\u95ED\u3002",
  "Copilot acts on a prompt you have not read. A model can misunderstand your request or add an unwanted step.": "Copilot \u4F1A\u6267\u884C\u4F60\u5C1A\u672A\u9605\u8BFB\u7684\u63D0\u793A\u8BCD\u3002\u6A21\u578B\u53EF\u80FD\u8BEF\u89E3\u8BF7\u6C42\u6216\u52A0\u5165\u4E0D\u9700\u8981\u7684\u6B65\u9AA4\u3002",
  "Adds a second button next to Enhance. Ctrl+Enter enhances the prompt and sends the result as a new Copilot message. Enter alone only enhances.": "\u5728\u589E\u5F3A\u65C1\u6DFB\u52A0\u7B2C\u4E8C\u4E2A\u6309\u94AE\u3002Ctrl+Enter \u589E\u5F3A\u63D0\u793A\u8BCD\u5E76\u5C06\u7ED3\u679C\u4F5C\u4E3A\u65B0\u7684 Copilot \u6D88\u606F\u53D1\u9001\u3002\u5355\u72EC\u6309 Enter \u53EA\u589E\u5F3A\u3002",
  "Automatic sending requires the same attached session and project, an idle session, and unchanged input. Closing or cancelling the run prevents sending.": "\u81EA\u52A8\u53D1\u9001\u8981\u6C42\u8FDE\u63A5\u7684\u4F1A\u8BDD\u548C\u9879\u76EE\u672A\u53D8\u3001\u4F1A\u8BDD\u7A7A\u95F2\u4E14\u8F93\u5165\u672A\u4FEE\u6539\u3002\u5173\u95ED\u6216\u53D6\u6D88\u8FD0\u884C\u4F1A\u963B\u6B62\u53D1\u9001\u3002",
  'It needs "Send to Copilot" to be on, and the checks of that switch still apply.': "\u9700\u8981\u5F00\u542F\u201C\u53D1\u9001\u5230 Copilot\u201D\uFF0C\u4E14\u4ECD\u9700\u6EE1\u8DB3\u8BE5\u5F00\u5173\u7684\u68C0\u67E5\u6761\u4EF6\u3002",
  "Sending to Copilot is off in Settings.": "\u8BBE\u7F6E\u4E2D\u5DF2\u5173\u95ED\u53D1\u9001\u5230 Copilot\u3002",
  "Download started.": "\u5DF2\u5F00\u59CB\u4E0B\u8F7D\u3002",
  "Changes could not be saved. Check the canvas connection and try again.": "\u65E0\u6CD5\u4FDD\u5B58\u66F4\u6539\u3002\u8BF7\u68C0\u67E5\u753B\u5E03\u8FDE\u63A5\u540E\u91CD\u8BD5\u3002",
  "The canvas could not connect. Close it and open Enhance Prompt again from Copilot.": "\u753B\u5E03\u65E0\u6CD5\u8FDE\u63A5\u3002\u8BF7\u5173\u95ED\u5B83\uFF0C\u7136\u540E\u4ECE Copilot \u91CD\u65B0\u6253\u5F00 Enhance Prompt\u3002",
  "Copilot is busy, waiting for your answer, or disconnected. Wait until the session is idle before sending.": "Copilot \u6B63\u5FD9\u3001\u6B63\u5728\u7B49\u5F85\u4F60\u7684\u56DE\u590D\u6216\u5DF2\u65AD\u5F00\u8FDE\u63A5\u3002\u8BF7\u7B49\u5F85\u4F1A\u8BDD\u7A7A\u95F2\u540E\u518D\u53D1\u9001\u3002",
  "A prompt was just sent. Wait for Copilot before sending again.": "\u521A\u521A\u53D1\u9001\u4E86\u63D0\u793A\u8BCD\u3002\u8BF7\u7B49\u5F85 Copilot \u540E\u518D\u53D1\u9001\u3002",
  "Changes the text Copilot receives; the chat still shows your original message. Off by default. Ambiguous prompts are left unchanged.": "\u66F4\u6539 Copilot \u63A5\u6536\u7684\u6587\u672C\uFF1B\u804A\u5929\u4E2D\u4ECD\u663E\u793A\u4F60\u7684\u539F\u59CB\u6D88\u606F\u3002\u9ED8\u8BA4\u5173\u95ED\u3002\u65E0\u6CD5\u660E\u786E\u5B9A\u4F4D\u7684\u63D0\u793A\u8BCD\u4F1A\u4FDD\u6301\u4E0D\u53D8\u3002"
};

// src/context/git.ts
import { execFile } from "node:child_process";
function git(cwd, args, options = {}) {
  const { signal } = options;
  if (signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve3) => {
    const onAbort = () => {
      killTree(child);
      resolve3(null);
    };
    const child = execFile(
      "git",
      // core.fsmonitor=false: a repository's own config cannot make a read run a program.
      ["-c", "core.quotepath=off", "-c", "color.ui=never", "-c", "core.fsmonitor=false", ...args],
      {
        cwd,
        timeout: options.timeoutMs ?? 4e3,
        maxBuffer: options.maxBytes ?? 2e6,
        windowsHide: true,
        encoding: "utf8",
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }
      },
      (error, stdout) => {
        signal?.removeEventListener("abort", onAbort);
        if (signal?.aborted) {
          resolve3(null);
          return;
        }
        if (error && !stdout) {
          resolve3(null);
          return;
        }
        resolve3(stdout);
      }
    );
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function isGitRepo(root, signal) {
  return (await git(root, ["rev-parse", "--is-inside-work-tree"], { timeoutMs: 2e3, signal }))?.trim() === "true";
}
var SAFE_PATHSPECS = [
  ".",
  ":(exclude,glob)**/.env*",
  ":(exclude,glob)**/*.pem",
  ":(exclude,glob)**/*.key",
  ":(exclude,glob)**/*lock*",
  ":(exclude,glob)**/*.min.*",
  ":(exclude,glob)**/*.map"
];
async function gitStatus(root, signal) {
  const out = await git(root, ["status", "--porcelain=v1", "-b", "--untracked-files=normal"], { signal });
  if (out === null) {
    return null;
  }
  const lines = out.split("\n").filter(Boolean);
  const branchLine = lines[0]?.startsWith("##") ? lines.shift().slice(3) : "";
  return { branchLine, changed: lines };
}
function statusLinePaths(line) {
  return line.slice(3).split(" -> ").map((path) => path.replace(/^"|"$/g, "")).filter(Boolean);
}
function changedPaths(statusLines) {
  return statusLines.map((line) => (line.slice(3).split(" -> ").pop() ?? "").replace(/^"|"$/g, "")).filter(Boolean);
}
async function gitLog(root, count, signal) {
  return git(root, ["log", `-n${count}`, "--no-merges", "--pretty=format:%h %s (%cr)"], { signal });
}
var MAX_DIFF_EXCLUSIONS = 300;
function parseNameStatus(out) {
  const fields = out.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    const sides = /^[RC]/.test(status) ? 2 : 1;
    entries.push(fields.slice(index, index + sides));
    index += sides;
  }
  return entries;
}
async function gitDiff(root, maxChars, allow = () => true, signal) {
  const names = await git(root, ["diff", "HEAD", "--name-status", "-z", "-M", "--", ...SAFE_PATHSPECS], { signal });
  if (names === null) return null;
  const refused = /* @__PURE__ */ new Set();
  for (const paths of parseNameStatus(names)) {
    if (paths.some((path) => isSensitive(path) || !allow(path))) paths.forEach((path) => refused.add(path));
  }
  if (refused.size > MAX_DIFF_EXCLUSIONS) return null;
  const pathspecs = [...SAFE_PATHSPECS, ...[...refused].map((path) => `:(exclude,literal)${path}`)];
  const stat4 = await git(root, ["diff", "HEAD", "-M", "--stat=100", "--", ...pathspecs], { signal });
  if (stat4 === null || !stat4.trim()) {
    return null;
  }
  const diff = await git(root, ["diff", "HEAD", "-M", "-U2", "--no-ext-diff", "--", ...pathspecs], { maxBytes: 4e6, signal }) ?? "";
  return { stat: stat4.trim(), diff: diff.length > maxChars ? `${maskedStart(diff, maxChars)}
\u2026(diff truncated)` : redactCode(diff) };
}
function maskedStart(text, maxChars) {
  const spare = text.slice(0, maxChars + 2e3);
  if (spare.length === text.length) return redactCode(text).slice(0, maxChars);
  let end = spare.lastIndexOf("\n");
  if (end < maxChars) {
    end = spare.length;
    while (end > 0 && !/\s/.test(spare[end - 1])) end--;
  }
  return redactCode(spare.slice(0, end)).slice(0, maxChars);
}
async function gitFiles(root, signal) {
  const out = await git(root, ["ls-files", "-co", "--exclude-standard"], { maxBytes: 16e6, timeoutMs: 6e3, signal });
  return out === null ? null : out.split("\n").filter(Boolean).slice(0, 5e4);
}
async function gitGrepCount(root, word, signal) {
  const counts = /* @__PURE__ */ new Map();
  const out = await git(root, ["grep", "-c", "-I", "-i", "-F", "--untracked", "--exclude-standard", "-e", word, "--", ...SAFE_PATHSPECS], {
    maxBytes: 4e6,
    timeoutMs: 5e3,
    signal
  });
  for (const line of (out ?? "").split("\n")) {
    const match = /^(.+):(\d+)$/.exec(line);
    if (match) counts.set(match[1], Number(match[2]));
  }
  return counts;
}
async function gitGrep(root, keywords, paths, maxLines = 600, signal) {
  const hits = /* @__PURE__ */ new Map();
  if (keywords.length === 0 || paths.length === 0) {
    return hits;
  }
  const args = ["grep", "-n", "-I", "-i", "-F", "--untracked", "--exclude-standard"];
  for (const word of keywords.slice(0, 12)) {
    args.push("-e", word);
  }
  args.push("--", ...paths.map((path) => `:(literal)${path}`));
  const out = await git(root, args, { maxBytes: 3e6, timeoutMs: 5e3, signal });
  if (!out) {
    return hits;
  }
  for (const line of out.split("\n").slice(0, maxLines * 4)) {
    const match = /^(.+?):(\d+):/.exec(line);
    if (!match) {
      continue;
    }
    const list = hits.get(match[1]) ?? [];
    if (list.length < 20) {
      list.push(Number(match[2]));
    }
    hits.set(match[1], list);
  }
  return hits;
}

// src/context/instructions.ts
var RULE_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  ".windsurfrules",
  ".clinerules",
  "CONTRIBUTING.md"
];
var README_SECTIONS = /install|setup|getting started|usage|develop|test|build|run|contribut|architecture|structure|overview|stack|scripts|commands/i;
function cap(text, max) {
  return text.length > max ? `${text.slice(0, max)}
\u2026(truncated)` : text;
}
function readmeDigest(text, max) {
  const lines = text.split(/\r?\n/);
  const sections = [{ heading: "", body: [] }];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    const heading = !inFence && /^#{1,4}\s+/.test(line);
    if (heading) {
      sections.push({ heading: line, body: [] });
    } else {
      sections[sections.length - 1].body.push(line);
    }
  }
  const introLines = [...sections[0].body];
  if (sections[1] && /^#\s/.test(sections[1].heading)) {
    introLines.push(...sections.splice(1, 1)[0].body);
  }
  const intro = introLines.join("\n").replace(/<[^>]+>/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
  const picked = sections.slice(1).filter((section) => README_SECTIONS.test(section.heading));
  const parts = [cap(intro, Math.floor(max / 4))];
  for (const section of picked) {
    parts.push(`${section.heading}
${section.body.join("\n").trim()}`);
  }
  return cap(parts.filter(Boolean).join("\n\n"), max);
}
async function readRuleFiles(root, fileList, extra, budget) {
  const present = new Set(fileList);
  const cursorRules = fileList.filter((f) => f.startsWith(".cursor/rules/") && /\.mdc?$/.test(f)).slice(0, 4);
  const names = [.../* @__PURE__ */ new Set([...extra, ...RULE_FILES, ...cursorRules])];
  const out = [];
  let used = 0;
  for (const name of names) {
    if (used >= budget) break;
    if (!present.has(name) && !extra.includes(name)) continue;
    const text = await readText(root, name);
    if (!text?.trim()) continue;
    const content = cap(text.trim(), Math.min(4e3, budget - used));
    used += content.length;
    out.push({ name, content });
  }
  const readme = fileList.find((f) => /^readme(\.md|\.rst|\.txt)?$/i.test(f));
  if (readme && used < budget) {
    const text = await readText(root, readme);
    if (text?.trim()) {
      out.push({ name: readme, content: readmeDigest(text, Math.min(3500, budget - used)) });
    }
  }
  return out;
}

// src/context/relevance.ts
var STOP = new Set(
  "the a an and or for with from into onto this that these those then than when where what which who how why add fix make update change create remove delete use using please need want should could would can will not all any some more less new old get set put run test tests code file files function page bug issue have has had are was were been be is it its to of in on at by as do does done so if else also just like cho c\u1EE7a v\xE0 v\u1EDBi c\xE1c nh\u1EEFng m\u1ED9t n\xE0y kia \u0111\xF3 khi th\xEC l\xE0 \u0111\u01B0\u1EE3c kh\xF4ng c\xF3 \u0111\u1EC3 trong ngo\xE0i l\xEAn xu\u1ED1ng s\u1EEDa th\xEAm xo\xE1 x\xF3a l\xE0m gi\xFAp m\xECnh t\xF4i b\u1EA1n c\xE1i n\xE0o g\xEC sao v\u1EADy nh\xE9 \u0111i r\u1ED3i l\u1EA1i c\u1EA7n mu\u1ED1n ph\u1EA3i n\xEAn h\xE3y v\xE0o ra trang l\u1ED7i ch\u1EE9c n\u0103ng".split(/\s+/)
);
function weightedKeywords(prompt, max = 12) {
  const found = /* @__PURE__ */ new Map();
  const add = (word, weight) => {
    const key = word.toLowerCase();
    if (key.length < 3 || STOP.has(key) || /^\d+$/.test(key)) return;
    found.set(key, Math.max(found.get(key) ?? 0, weight));
  };
  for (const match of prompt.matchAll(/`([^`]{2,80})`/g)) add(match[1].trim(), 5);
  for (const match of prompt.matchAll(/[\w@.-]*[/\\][\w@./\\-]+/g)) {
    add(match[0].replace(/\\/g, "/").replace(/^\.\//, ""), 5);
    add(match[0].split(/[/\\]/).pop() ?? "", 4);
  }
  for (const match of prompt.matchAll(/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){1,4}\b/g)) {
    if (!/\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|cs|vue|svelte|css|scss|md|json|ya?ml|toml|sql)$/i.test(match[0])) add(match[0], 5);
  }
  for (const match of prompt.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    const word = match[0];
    if (/[a-z][A-Z]|_|^[A-Z][a-z]+[A-Z]/.test(word)) {
      add(word, 4);
      for (const part of word.split(/(?=[A-Z])|_/)) add(part, 2);
    } else {
      add(word, word.length >= 6 ? 2 : 1);
    }
  }
  for (const match of prompt.matchAll(/\b\w+\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|cs|vue|svelte|css|scss|md|json|yaml|yml|toml|sql)\b/gi)) {
    add(match[0], 5);
  }
  return [...found.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([word, weight]) => ({ word, weight }));
}
var LOW_VALUE = /(^|\/)(test-fixtures|fixtures|__snapshots__|snapshots|migrations|generated|locales?|i18n)\//i;
var TEST_FILE = /(\.|_)(test|spec)\.|(^|\/)tests?\//i;
function contentScores(perWord, totalFiles, weights = []) {
  const scores = /* @__PURE__ */ new Map();
  perWord.forEach((counts, index) => {
    const df = counts.size;
    if (df === 0 || df > Math.max(20, totalFiles * 0.05)) return;
    const idf = Math.log((totalFiles + 1) / (df + 1));
    const k = keywordFactor(weights[index] ?? 4);
    for (const [file, count] of counts) {
      scores.set(file, (scores.get(file) ?? 0) + k * idf * (1 + Math.log(count)));
    }
  });
  return scores;
}
var keywordFactor = (weight) => weight >= 4 ? 1 : weight >= 2 ? 0.6 : 0.35;
function scoreFiles(files, keywordList, content, changed, promptMentionsTests) {
  const keywords = keywordList.map((entry) => typeof entry === "string" ? { word: entry, weight: 4 } : entry);
  const out = [];
  for (const path of files) {
    const lower = path.toLowerCase();
    const name = lower.split("/").pop() ?? lower;
    const stem = name.replace(/\.[^.]+$/, "");
    let score = 0;
    for (const { word, weight } of keywords) {
      const k = keywordFactor(weight);
      if (word.includes("/") && lower.endsWith(word)) score += 12;
      else if (name === word) score += 10 * k;
      else if (stem === word) score += 8 * k;
      else if (stem.includes(word)) score += 4 * k;
      else if (lower.includes(`/${word}/`) || lower.startsWith(`${word}/`)) score += 3 * k;
      else if (lower.includes(word)) score += 1 * k;
    }
    score += Math.min(24, content.get(path) ?? 0);
    if (changed.has(path)) score += score > 0 ? 4 : 1.5;
    if (score <= 0) continue;
    if (LOW_VALUE.test(path)) score *= 0.4;
    if (TEST_FILE.test(path) && !promptMentionsTests) score *= 0.6;
    out.push({ path, score, hits: [] });
  }
  return out.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
}

// src/context/stack.ts
var truncate = (text, max) => text.length > max ? `${text.slice(0, max)}\u2026` : text;
function packageJson(text, files) {
  const out = [];
  try {
    const pkg = JSON.parse(text);
    const manager = pkg.packageManager?.split("@")[0] ?? (files.has("pnpm-lock.yaml") ? "pnpm" : files.has("yarn.lock") ? "yarn" : files.has("bun.lockb") || files.has("bun.lock") ? "bun" : "npm");
    out.push(`Node project${pkg.name ? ` "${pkg.name}"` : ""}, package manager: ${manager}${pkg.workspaces ? " (monorepo workspaces)" : ""}`);
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    if (deps.length > 0) {
      out.push(`Key dependencies: ${deps.slice(0, 30).join(", ")}${deps.length > 30 ? ", \u2026" : ""}`);
    }
    const scripts = Object.entries(pkg.scripts ?? {});
    if (scripts.length > 0) {
      out.push(`Scripts (run with "${manager} run <name>"):`);
      for (const [name, command] of scripts.slice(0, 25)) {
        out.push(`  ${name}: ${truncate(command, 120)}`);
      }
    }
  } catch {
  }
  return out;
}
function makefileTargets(text) {
  const targets = [...text.matchAll(/^([A-Za-z0-9_.-]+):(?!=)/gm)].map((match) => match[1]).filter((name) => !name.startsWith("."));
  return targets.length > 0 ? [`Makefile targets: ${[...new Set(targets)].slice(0, 25).join(", ")}`] : [];
}
function tomlSection(text, section, maxLines = 25) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `[${section}]`);
  if (start < 0) {
    return null;
  }
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*\[/.test(line) || body.length >= maxLines) {
      break;
    }
    if (line.trim()) {
      body.push(`  ${line.trim()}`);
    }
  }
  return body.length > 0 ? `[${section}]
${body.join("\n")}` : null;
}
async function detectStack(root, fileList) {
  const files = new Set(fileList.filter((file) => !file.includes("/")));
  const out = [];
  const read = (name) => files.has(name) ? readText(root, name, 3e5) : Promise.resolve(null);
  const pkg = await read("package.json");
  if (pkg) out.push(...packageJson(pkg, files));
  if (files.has("tsconfig.json")) out.push("TypeScript (tsconfig.json)");
  if (files.has("deno.json") || files.has("deno.jsonc")) out.push("Deno project");
  const pyproject = await read("pyproject.toml");
  if (pyproject) {
    out.push(`Python project${files.has("uv.lock") ? " (uv)" : files.has("poetry.lock") ? " (poetry)" : ""}`);
    for (const section of ["project", "tool.poetry", "tool.pytest.ini_options", "project.scripts"]) {
      const body = tomlSection(pyproject, section, 15);
      if (body) out.push(body);
    }
  } else if (files.has("requirements.txt")) {
    const reqs = await read("requirements.txt") ?? "";
    out.push(`Python requirements: ${reqs.split(/\r?\n/).map((l) => l.split(/[=<>~ ]/)[0]).filter(Boolean).slice(0, 25).join(", ")}`);
  }
  const gomod = await read("go.mod");
  if (gomod) out.push(`Go module: ${gomod.split(/\r?\n/).slice(0, 3).join(" | ")} (test: go test ./...)`);
  const cargo = await read("Cargo.toml");
  if (cargo) {
    out.push("Rust (cargo build / cargo test)");
    const pkgSection = tomlSection(cargo, "package", 6);
    const deps = tomlSection(cargo, "dependencies", 20);
    if (pkgSection) out.push(pkgSection);
    if (deps) out.push(deps);
  }
  if (files.has("pom.xml")) out.push("Java/Maven (mvn test)");
  if (files.has("build.gradle") || files.has("build.gradle.kts")) out.push("Gradle (./gradlew test)");
  if (files.has("composer.json")) out.push("PHP/Composer");
  if (files.has("Gemfile")) out.push("Ruby/Bundler");
  if ([...files].some((f) => f.endsWith(".csproj") || f.endsWith(".sln"))) out.push(".NET (dotnet build / dotnet test)");
  if (files.has("pubspec.yaml")) out.push("Dart/Flutter (flutter test)");
  if (files.has("Dockerfile") || files.has("docker-compose.yml") || files.has("compose.yaml")) out.push("Docker present");
  const makefile = await read("Makefile");
  if (makefile) out.push(...makefileTargets(makefile));
  const justfile = await read("justfile") ?? await read("Justfile");
  if (justfile) out.push(...makefileTargets(justfile).map((line) => line.replace("Makefile", "just")));
  const ci = fileList.filter((f) => f.startsWith(".github/workflows/")).slice(0, 5);
  if (ci.length > 0) out.push(`CI workflows: ${ci.join(", ")}`);
  return out.length > 0 ? out.join("\n") : null;
}

// src/context/terminals.ts
var TERMINALS_KEY = "terminalWorkspaces";
var MAX_TERMINALS = 500;
var MAX_ID_CHARS = 1200;
var known = /* @__PURE__ */ new Map();
var loading = null;
var saving = Promise.resolve();
var isId = (value) => typeof value === "string" && value.length > 0 && value.length <= MAX_ID_CHARS;
function prune() {
  for (const id2 of [...known.keys()].slice(0, Math.max(0, known.size - MAX_TERMINALS))) known.delete(id2);
}
function loadTerminals(host) {
  loading ??= (async () => {
    const stored = await host.storage.get(TERMINALS_KEY).catch(() => null);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
    const merged = /* @__PURE__ */ new Map();
    for (const [terminal, workspace] of Object.entries(stored)) if (isId(terminal) && isId(workspace)) merged.set(terminal, workspace);
    for (const [terminal, workspace] of known) {
      merged.delete(terminal);
      merged.set(terminal, workspace);
    }
    known = merged;
    prune();
  })();
  return loading;
}
function save(host) {
  saving = saving.then(() => loadTerminals(host)).then(() => host.storage.set(TERMINALS_KEY, Object.fromEntries(known))).catch((error) => host.log(`terminals: ${error.message}`));
}
function learnTerminal(host, terminalId, workspaceId) {
  if (!isId(terminalId) || !isId(workspaceId) || known.get(terminalId) === workspaceId) return;
  known.delete(terminalId);
  known.set(terminalId, workspaceId);
  prune();
  save(host);
}
function forgetTerminal(host, terminalId) {
  if (known.delete(terminalId)) save(host);
}
function workspacesOfTerminals(terminalIds) {
  const count = /* @__PURE__ */ new Map();
  for (const id2 of terminalIds) {
    const workspace = known.get(id2);
    if (workspace) count.set(workspace, (count.get(workspace) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([workspace]) => workspace);
}
async function forgetTerminals(host) {
  await saving.catch(() => void 0);
  known = /* @__PURE__ */ new Map();
  loading = host ? Promise.resolve() : null;
  saving = Promise.resolve();
  if (host) await host.storage.delete(TERMINALS_KEY).catch(() => void 0);
}

// src/context/index.ts
var LEVEL_RANK = { off: 0, basic: 1, standard: 2, deep: 3, max: 4 };
var BUDGET = { off: 0, basic: 1e3, standard: 12e3, deep: 28e3, max: 45e3 };
var RELEVANT_FILES = { off: 0, basic: 0, standard: 0, deep: 6, max: 10 };
var atLeast = (level, min) => LEVEL_RANK[level] >= LEVEL_RANK[min];
var isLocalWorkspace = (workspace) => workspace.hostId === null || workspace.hostId === "local";
function stopIfCancelled(signal) {
  if (signal?.aborted) throw new LlmError(msg("error.cancelled"), "cancelled");
}
function contextItem(id2, kind, label, content, why) {
  return item(id2, kind, label, content, why);
}
var item = (id2, kind, label, content, why) => ({
  id: id2,
  kind,
  label: english(label),
  content,
  chars: content.length,
  ...label.code === "raw" ? {} : { title: label },
  ...why ? { note: english(why), why } : {}
});
async function focusedCandidates(host, focused) {
  if (!host.host.has("workspace.list")) return [];
  const list = await host.host.call("workspace.list", {}).catch(() => null);
  const exact = (list?.workspaces ?? []).filter((ws) => ws.name === focused.displayName && (ws.branch ?? "") === focused.branch && isLocalWorkspace(ws));
  return exact.length > 1 ? exact.map((ws) => ({ id: ws.id, path: ws.path, ...ws.project ? { project: ws.project } : {} })) : [];
}
function fittingWorkspace(workspaces, id2, focused) {
  const named = workspaces.filter((ws) => namesWorkspace(id2, ws) && (ws.name === focused.displayName || (ws.branch ?? "") === focused.branch));
  if (named.length === 1) return named[0];
  const both = named.filter((ws) => ws.name === focused.displayName && (ws.branch ?? "") === focused.branch);
  return both.length === 1 ? both[0] : null;
}
async function findFocusedWorkspace(host, focused, hint) {
  if (!host.host.has("workspace.list")) return null;
  try {
    const workspaces = (await host.host.call("workspace.list", {})).workspaces;
    const terminals = (focused.terminals ?? []).map((terminal) => terminal.id);
    await loadTerminals(host);
    if (typeof focused.workspaceId === "string" && focused.workspaceId) {
      const named = fittingWorkspace(workspaces, focused.workspaceId, focused);
      if (named) {
        for (const terminal of terminals) learnTerminal(host, terminal, focused.workspaceId);
        return named;
      }
    }
    for (const id2 of workspacesOfTerminals(terminals)) {
      const said = fittingWorkspace(workspaces, id2, focused);
      if (said) {
        for (const terminal of terminals) learnTerminal(host, terminal, id2);
        return said;
      }
    }
    for (const id2 of typeof hint === "string" ? [hint] : hint ?? []) {
      const hinted = fittingWorkspace(workspaces, id2, focused);
      if (hinted) return hinted;
    }
    const exact = workspaces.filter((ws) => ws.name === focused.displayName && (ws.branch ?? "") === focused.branch);
    if (exact.length === 1) return exact[0];
    const byBranch = focused.branch ? workspaces.filter((ws) => ws.branch === focused.branch) : [];
    if (byBranch.length === 1) return byBranch[0];
    const byName = workspaces.filter((ws) => ws.name === focused.displayName);
    return byName.length === 1 ? byName[0] : null;
  } catch {
    return null;
  }
}
async function workspaceOfTerminal(host, terminalId, focused) {
  if (!terminalId || !host.host.has("workspace.list")) return null;
  await loadTerminals(host);
  const ids = workspacesOfTerminals([terminalId]);
  if (ids.length === 0) return null;
  const list = await host.host.call("workspace.list", {}).catch(() => null);
  const workspaces = list?.workspaces ?? [];
  const inFocus = focused?.terminals?.some((terminal) => terminal.id === terminalId) ?? false;
  for (const id2 of ids) {
    if (focused && inFocus) {
      const fits = inFocusedWorkspace(workspaces, id2, focused);
      if (!fits && list && !list.truncated) forgetTerminal(host, terminalId);
      return fits;
    }
    const named = workspaces.filter((ws) => namesWorkspace(id2, ws));
    if (named.length === 1) return named[0];
  }
  return null;
}
function inFocusedWorkspace(workspaces, id2, focused) {
  const named = workspaces.filter((ws) => namesWorkspace(id2, ws));
  const fits = typeof focused.workspaceId === "string" && focused.workspaceId ? named.filter((ws) => namesWorkspace(focused.workspaceId, ws)) : named.filter((ws) => ws.name === focused.displayName && (ws.branch ?? "") === focused.branch);
  return fits.length === 1 ? fits[0] : null;
}
async function projectNameOf(host, focused, workspace) {
  if (workspace) return workspace.project?.trim() || workspace.name;
  if (!host.host.has("workspace.list")) return focused.displayName;
  const list = await host.host.call("workspace.list", {}).catch(() => null);
  const alike = (list?.workspaces ?? []).filter((ws) => ws.name === focused.displayName && (ws.branch ?? "") === focused.branch);
  return alike.length > 1 ? null : focused.displayName;
}
async function focusedProject(host, hint) {
  const focused = await host.host.call("workspace.readContext", {}).catch(() => null);
  if (!focused) return { workspace: null, project: null };
  return { workspace: focused.displayName, project: await projectNameOf(host, focused, await findFocusedWorkspace(host, focused, hint)) };
}
var staticCache = /* @__PURE__ */ new Map();
var STATIC_TTL_MS = 9e4;
function cachedStatic(root) {
  const hit = staticCache.get(`git:${root}`) ?? staticCache.get(`nogit:${root}`);
  return hit && Date.now() - hit.at < STATIC_TTL_MS * 4 ? hit : null;
}
async function staticParts(root, extraFiles, fresh = false, allowGit = true, signal, onProgress = () => void 0) {
  const cacheKey = `${allowGit ? "git" : "nogit"}:${root}`;
  const hit = staticCache.get(cacheKey);
  if (hit && !fresh && Date.now() - hit.at < STATIC_TTL_MS) return hit;
  const isGit = allowGit && await isGitRepo(root, signal);
  onProgress(0.15);
  const listed = (isGit ? await gitFiles(root, signal) : null) ?? await walkFiles(root, void 0, void 0, signal);
  stopIfCancelled(signal);
  onProgress(0.5);
  const files = listed.filter((file) => !isSensitive(file));
  const items = [];
  for (const rule of await readRuleFiles(root, files, extraFiles, 9e3)) {
    items.push(item(`rules:${rule.name}`, "rules", raw(rule.name), rule.content));
  }
  onProgress(0.8);
  const stack = await detectStack(root, files);
  if (stack) items.push(item("stack", "stack", msg("label.stack"), stack));
  if (files.length > 0) items.push(item("tree", "tree", msg("label.tree", { count: files.length }), treeSummary(files)));
  stopIfCancelled(signal);
  const parts = { at: Date.now(), files, isGit, items };
  staticCache.set(cacheKey, parts);
  return parts;
}
async function gatherContext(host, options) {
  const { level } = options;
  const step = options.onStep ?? (() => void 0);
  const items = [];
  const notes = [];
  if (level === "off") return { items, notes, root: null };
  const { signal } = options;
  stopIfCancelled(signal);
  step("workspace", "running");
  const focused = await host.host.call("workspace.readContext", {}).catch(() => null);
  const workspace = focused ? await findFocusedWorkspace(host, focused, options.workspaceId) : null;
  const title = focused ? workspaceTitle(focused.displayName, workspace?.project) : void 0;
  if (focused) {
    items.push(item("workspace", "workspace", msg("label.workspace"), `${title}${focused.branch ? ` (branch ${focused.branch})` : ""}`));
  } else {
    notes.push(msg("note.no_workspace"));
  }
  if (options.terminalId) {
    const agents = await host.host.call("agents.list", {}).catch(() => null);
    const agent = agents?.agents.find((entry) => entry.terminalId === options.terminalId);
    if (agent?.agent) items.push(item("agent", "agent", msg("label.agent"), `${agent.agent} (${agent.state})`));
  }
  step("workspace", "done", title);
  let root = null;
  if (atLeast(level, "standard")) step("project", "running");
  if (focused && atLeast(level, "standard")) {
    if (!workspace) {
      notes.push(msg("note.workspace_unknown"));
    } else if (!isLocalWorkspace(workspace)) {
      notes.push(msg("note.remote"));
    } else {
      root = workspace.path;
    }
  }
  const saved = root && workspace && options.allowEditorSaves === true && atLeast(level, "deep") ? savedFiles(workspace).map((path) => relativeTo(root, path)).filter((path) => path !== null && !isSensitive(path)) : [];
  if (root) {
    stopIfCancelled(signal);
    const parts = await staticParts(root, options.extraFiles, false, options.allowGit !== false, signal, (fraction) => step("project", "running", void 0, fraction));
    items.push(...parts.items);
    step("project", "done", String(parts.files.length));
    if (atLeast(level, "deep")) {
      items.push(...await dynamicParts(root, parts, options, notes, saved));
      if (saved.length > 0 && !options.exclude.has("saved")) items.push(item("saved", "saved", msg("label.saved"), saved.map((path) => `- ${path}`).join("\n")));
      const activity = workspace && options.allowAgentActivity === true && !options.exclude.has("activity") ? agentActivity(workspace) : "";
      if (activity) items.push(item("activity", "activity", msg("label.activity"), activity));
    }
  } else if (atLeast(level, "standard")) {
    step("project", "skipped");
    if (atLeast(level, "deep")) {
      step("git", "skipped");
      step("search", "skipped");
    }
    if (level === "max") step("pick", "skipped");
  }
  if (level === "max" && options.allowTerminal === false) notes.push(msg("note.terminal_off"));
  const readTerminal = level === "max" && options.allowTerminal !== false && Boolean(options.terminalId) && options.terminalLines > 0 && !options.exclude.has("terminal");
  if (level === "max" && !readTerminal) step("terminal", "skipped");
  if (readTerminal && options.terminalId) {
    step("terminal", "running");
    stopIfCancelled(signal);
    const read = await host.host.call("terminal.read", { terminalId: options.terminalId, maxLines: options.terminalLines }, signal ? { signal } : void 0).catch(() => null);
    stopIfCancelled(signal);
    const lines = (read?.lines ?? []).map((line) => line.trimEnd()).filter(Boolean);
    if (lines.length > 0) {
      const title2 = focused?.terminals.find((t) => t.id === options.terminalId)?.title ?? "agent terminal";
      items.push(item("terminal", "terminal", msg("label.terminal", { name: title2 }), redactSecrets(lines.join("\n"))));
    }
    step("terminal", "done", String(lines.length));
  }
  if (level === "max" && options.allowOtherAgents === true) {
    items.push(...await otherAgentItems(host, options, step));
  }
  stopIfCancelled(signal);
  return { items: fitBudget(items.filter((entry) => !options.exclude.has(entry.id)), BUDGET[level]), notes, root };
}
function relativeTo(root, path) {
  const norm = (value) => value.replace(/\\/g, "/").replace(/\/+$/, "");
  const base = norm(root);
  const full = norm(path);
  if (!/^([a-zA-Z]:)?\//.test(full)) return full.includes("..") ? null : full.replace(/^\.\//, "");
  const same = process.platform === "win32" ? full.toLowerCase().startsWith(`${base.toLowerCase()}/`) : full.startsWith(`${base}/`);
  return same ? full.slice(base.length + 1) : null;
}
async function dynamicParts(root, parts, options, notes, saved = []) {
  const out = [];
  const patterns = compilePatterns(options.excludePatterns);
  const alreadyIncluded = new Set(parts.items.filter((entry) => entry.kind === "rules").map((entry) => entry.label));
  const isProse = (file) => /\.(md|mdx|rst|txt)$/i.test(file);
  const files = parts.files.filter((file) => {
    if (isExcluded(file, patterns) || isBinaryPath(file) || alreadyIncluded.has(file)) return false;
    return !isProse(file) || file.startsWith("docs/");
  });
  let changed = /* @__PURE__ */ new Set();
  const step = options.onStep ?? (() => void 0);
  const { signal } = options;
  stopIfCancelled(signal);
  if (parts.isGit) {
    step("git", "running");
    const skip = (id2) => options.exclude.has(id2);
    const diffChars = options.level === "max" ? 9e3 : 5e3;
    let finished = 0;
    const counted = (read) => Promise.resolve(read).then((value) => {
      finished++;
      if (finished < 3) step("git", "running", void 0, finished / 3);
      return value;
    });
    const [status, log, diff] = await Promise.all([
      counted(gitStatus(root, signal)),
      counted(skip("git:log") ? null : gitLog(root, 6, signal)),
      counted(skip("git:diff") ? null : gitDiff(root, diffChars, (path) => !isExcluded(path, patterns), signal))
    ]);
    stopIfCancelled(signal);
    if (status && !skip("git:status") && (status.changed.length > 0 || status.branchLine)) {
      const shown = status.changed.filter((line) => !statusLinePaths(line).some((path) => isSensitive(path) || isExcluded(path, patterns)));
      out.push(
        item(
          "git:status",
          "git",
          msg("label.status", { count: shown.length }),
          [status.branchLine && `## ${status.branchLine}`, ...shown.slice(0, 60)].filter(Boolean).join("\n")
        )
      );
    }
    if (status) changed = /* @__PURE__ */ new Set([...changedPaths(status.changed), ...saved]);
    if (log?.trim()) out.push(item("git:log", "git", msg("label.log"), log.trim()));
    if (diff) out.push(item("git:diff", "git", msg("label.diff"), `${diff.stat}

${diff.diff}`));
    step("git", "done", String(changed.size));
  } else {
    notes.push(msg("note.not_git"));
    step("git", "skipped");
    changed = new Set(saved);
  }
  stopIfCancelled(signal);
  step("search", "running");
  const weighted = weightedKeywords(options.prompt);
  const keywords = weighted.map((entry) => entry.word);
  const grepTargets = weighted.filter((entry) => entry.word.length >= 4).slice(0, 8);
  const grepWords = grepTargets.map((entry) => entry.word);
  let searched = 0;
  const perWord = parts.isGit ? await Promise.all(
    grepWords.map(
      (word) => gitGrepCount(root, word, signal).then((counts) => {
        searched++;
        step("search", "running", void 0, searched / grepWords.length * 0.9);
        return counts;
      })
    )
  ) : [];
  stopIfCancelled(signal);
  const content = contentScores(perWord, files.length, grepTargets.map((entry) => entry.weight));
  const mentionsTests = /\btest|spec|kiểm thử/i.test(options.prompt);
  const scored = scoreFiles(files, weighted, content, changed, mentionsTests);
  const picked = scored.slice(0, RELEVANT_FILES[options.level]).map((entry) => ({ path: entry.path, hits: [], why: msg("why.keyword") }));
  step("search", "done", String(picked.length));
  if (options.level === "max" && !options.pickFiles) step("pick", "skipped");
  if (options.level === "max" && options.pickFiles) {
    step("pick", "running");
    try {
      const shortlist = [.../* @__PURE__ */ new Set([...scored.slice(0, 150).map((s) => s.path), ...files])].slice(0, 600);
      const chosen = await options.pickFiles(shortlist, options.prompt);
      for (const path of chosen.filter((p) => files.includes(p)).slice(0, 8)) {
        if (!picked.some((entry) => entry.path === path)) {
          picked.push({ path, hits: [], why: msg("why.ai") });
        }
      }
      step("pick", "done", String(picked.length));
    } catch (error) {
      stopIfCancelled(signal);
      notes.push(msg("note.picker_skipped", { reason: messageOf(error) }));
      step("pick", "skipped");
    }
  }
  stopIfCancelled(signal);
  const lines = parts.isGit ? await gitGrep(root, grepWords, picked.map((entry) => entry.path), void 0, signal) : /* @__PURE__ */ new Map();
  stopIfCancelled(signal);
  for (const entry of picked) entry.hits = lines.get(entry.path) ?? [];
  const perFile = options.level === "max" ? 1800 : 1400;
  for (const entry of picked) {
    if (options.exclude.has(`file:${entry.path}`)) continue;
    const text = await readText(root, entry.path);
    if (!text) continue;
    out.push(item(`file:${entry.path}`, "file", raw(entry.path), snippet(redactCode(text), entry.hits, perFile), entry.why));
  }
  if (keywords.length > 0 && picked.length === 0) {
    notes.push(msg("note.no_files"));
  }
  return out;
}
async function otherAgentItems(host, options, step) {
  const { signal } = options;
  if (options.exclude.has("agents")) {
    step("agents", "skipped");
    return [];
  }
  step("agents", "running");
  stopIfCancelled(signal);
  const limits = options.otherAgentsLimits ?? { agents: MAX_SESSIONS, lines: SESSION_LINES };
  const agents = (await otherAgents(host, options.terminalId, signal)).slice(0, limits.agents);
  stopIfCancelled(signal);
  if (agents.length === 0) {
    step("agents", "done", "0");
    return [];
  }
  const out = [item("agents", "agents", msg("label.agents"), agentsSummary(agents))];
  for (const [index, agent] of agents.entries()) {
    const id2 = `session:${agent.terminalId}`;
    if (options.exclude.has(id2)) continue;
    const text = await readSession(host, agent.terminalId, signal, limits.lines);
    stopIfCancelled(signal);
    step("agents", "running", void 0, (index + 1) / agents.length);
    if (text) out.push(item(id2, "session", msg("label.session", { name: agent.title ?? agent.agent ?? agent.terminalId }), text));
  }
  step("agents", "done", String(agents.length));
  return out;
}
function fitBudget(items, budget) {
  const priority = { workspace: 0, agent: 0, rules: 1, stack: 2, file: 3, git: 4, terminal: 5, tree: 6, activity: 7, saved: 7, agents: 8, session: 9 };
  const sorted = [...items].sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9));
  const out = [];
  let used = 0;
  for (const entry of sorted) {
    if (used >= budget) {
      break;
    }
    if (used + entry.chars <= budget) {
      out.push(entry);
      used += entry.chars;
    } else if (budget - used > 400) {
      const content = `${entry.content.slice(0, budget - used)}
\u2026(trimmed to fit)`;
      out.push({ ...entry, content, chars: content.length, note: english(msg("why.trimmed")), why: msg("why.trimmed") });
      used = budget;
    }
  }
  return out;
}

// src/images.ts
function sniffImage(head) {
  const at = (index, ...bytes) => bytes.every((byte, offset) => head[index + offset] === byte);
  if (at(0, 137, 80, 78, 71, 13, 10, 26, 10)) return "image/png";
  if (at(0, 255, 216, 255)) return "image/jpeg";
  if (at(0, 71, 73, 70, 56)) return "image/gif";
  if (at(0, 82, 73, 70, 70) && at(8, 87, 69, 66, 80)) return "image/webp";
  return null;
}
var megabytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
function imageSupport(profile) {
  if (profile.provider === "copilot") return "data";
  if (profile.provider === "anthropic") return "data";
  if (profile.provider === "openai") return ["openai", "openrouter", "gemini"].includes(profile.preset) ? "data" : "none";
  return profile.preset === "codex" ? "file" : "none";
}
function imagesBlock(images) {
  if (images.length === 0) return "";
  return `<attached_images>
${images.map((image, index) => `${index + 1}. ${image.path} (${image.name}, ${megabytes(image.bytes)})`).join("\n")}
</attached_images>`;
}
function withImagePaths(prompt, images) {
  const missing = images.filter((image) => !prompt.includes(image.path));
  if (missing.length === 0) return prompt;
  return `${prompt.trimEnd()}

Attached images (open them):
${missing.map((image) => `- ${image.path}`).join("\n")}`;
}

// src/attachments.ts
import { appendFile, mkdir, readdir as readdir2, readFile as readFile4, rm as rm2, stat as stat3 } from "node:fs/promises";
import { tmpdir as tmpdir2 } from "node:os";
import { basename, isAbsolute as isAbsolute2, join as join4, relative as relative2, resolve } from "node:path";

// src/image-limits.ts
var MAX_IMAGES = 4;
var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
var MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
var REQUEST_INPUT_LIMIT = 64 * 1024;
var ATTACHMENT_CHUNK_BYTES = 44 * 1024;
var MAX_CHUNK_BASE64 = Math.ceil(ATTACHMENT_CHUNK_BYTES / 3) * 4;
var attachmentItemId = (path) => `attach:${path.split(/[\\/]/).slice(-2).join("/")}`;
function sizeOver(size, max) {
  const mb = (bytes, digits) => (bytes / (1024 * 1024)).toFixed(digits);
  for (const digits of [1, 2, 3]) if (mb(size, digits) !== mb(max, digits)) return `${mb(size, digits)} MB`;
  return `${size.toLocaleString("en-US")} bytes`;
}

// src/attachments.ts
var ATTACHMENTS_DIR = join4(tmpdir2(), `enhance-prompt-attachments${process.env.NODE_TEST_CONTEXT ? `-test-${process.pid}` : ""}`);
var TEXT_MAX = 2e4;
var DAY_MS = 24 * 36e5;
function safeName(name) {
  const cleaned = basename(name).replace(/[^\p{L}\p{N}._ -]+/gu, "_").replace(/^\.+/, "").trim().slice(0, 120);
  return cleaned || "file";
}
async function putChunk(input) {
  if (!/^[a-z0-9-]{6,40}$/.test(input.id)) throw new LlmError(msg("error.attachment_bad"), "invalid_params");
  if (typeof input.data !== "string" || input.data.length > MAX_CHUNK_BASE64) throw new LlmError(msg("error.attachment_bad"), "invalid_params");
  if (input.index === 0 && typeof input.size === "number" && input.size > MAX_ATTACHMENT_BYTES) {
    throw new LlmError(msg("error.file_too_large", { name: safeName(input.name), size: sizeOver(input.size, MAX_ATTACHMENT_BYTES), max: megabytes(MAX_ATTACHMENT_BYTES) }), "too_large");
  }
  if (!Number.isInteger(input.index) || !Number.isInteger(input.total) || input.index < 0 || input.index >= input.total) {
    throw new LlmError(msg("error.attachment_bad"), "invalid_params");
  }
  const dir = join4(ATTACHMENTS_DIR, input.id);
  const path = join4(dir, safeName(input.name));
  if (input.index === 0) {
    await rm2(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  }
  const bytes = Buffer.from(input.data, "base64");
  const written = await stat3(path).then((info) => info.size).catch(() => null);
  if (input.index > 0 && written === null) throw new LlmError(msg("error.attachment_bad"), "invalid_params");
  const before = written ?? 0;
  if (before + bytes.length > MAX_ATTACHMENT_BYTES) {
    await rm2(dir, { recursive: true, force: true });
    throw new LlmError(msg("error.file_too_large", { name: safeName(input.name), size: sizeOver(before + bytes.length, MAX_ATTACHMENT_BYTES), max: megabytes(MAX_ATTACHMENT_BYTES) }), "too_large");
  }
  await appendFile(path, bytes);
  if (input.index < input.total - 1) return { received: before + bytes.length };
  return { path, bytes: before + bytes.length };
}
async function cleanAttachments(now = Date.now()) {
  const entries = await readdir2(ATTACHMENTS_DIR).catch(() => []);
  for (const entry of entries) {
    const info = await stat3(join4(ATTACHMENTS_DIR, entry)).catch(() => null);
    if (info && now - info.mtimeMs > DAY_MS) await rm2(join4(ATTACHMENTS_DIR, entry), { recursive: true, force: true }).catch(() => void 0);
  }
}
async function clearAttachments() {
  await rm2(ATTACHMENTS_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
function isAttachment(path) {
  const inside = relative2(ATTACHMENTS_DIR, resolve(path));
  return inside !== "" && !inside.startsWith("..") && !isAbsolute2(inside);
}
function excerpt(text, max = TEXT_MAX) {
  if (text.length <= max) return { text, cut: 0 };
  const headMax = Math.floor(max * 0.6);
  let head = text.slice(0, headMax);
  let tail = text.slice(text.length - (max - headMax));
  const lineEnd = head.lastIndexOf("\n");
  if (lineEnd >= head.length * 0.8) head = head.slice(0, lineEnd);
  const lineStart = tail.indexOf("\n");
  if (lineStart !== -1 && lineStart < tail.length * 0.2) tail = tail.slice(lineStart + 1);
  if (/[\uD800-\uDBFF]$/.test(head)) head = head.slice(0, -1);
  if (/^[\uDC00-\uDFFF]/.test(tail)) tail = tail.slice(1);
  const cut = text.length - head.length - tail.length;
  return { text: `${head}
\u2026(${cut.toLocaleString("en-US")} characters left out)\u2026
${tail}`, cut };
}
async function loadFiles(paths) {
  const out = { images: [], texts: [], paths: [] };
  for (const path of paths) {
    if (!isAttachment(path)) throw new LlmError(msg("error.attachment_bad"), "invalid_params");
    const info = await stat3(path).catch(() => null);
    if (!info || !info.isFile()) throw new LlmError(msg("error.attachment_missing", { name: basename(path) }), "invalid_params");
    if (info.size > MAX_ATTACHMENT_BYTES) {
      throw new LlmError(msg("error.file_too_large", { name: basename(path), size: sizeOver(info.size, MAX_ATTACHMENT_BYTES), max: megabytes(MAX_ATTACHMENT_BYTES) }), "too_large");
    }
    const bytes = await readFile4(path);
    out.paths.push(path);
    const type = sniffImage(bytes.subarray(0, 16));
    if (type && info.size <= MAX_IMAGE_BYTES && out.images.length < MAX_IMAGES) {
      out.images.push({ path, name: basename(path), bytes: info.size, type, base64: bytes.toString("base64") });
      continue;
    }
    if (type || bytes.includes(0)) continue;
    const { text: content, cut } = excerpt(bytes.toString("utf8"));
    out.texts.push({ path, name: basename(path), content, cut });
  }
  return out;
}

// src/rules.ts
var RULES_KEY = "rules";
var MAX_RULES = 1e3;
var MAX_RULE_CHARS = 500;
var MAX_STRUCTURES = 20;
var MAX_SECTIONS = 12;
var SCOPE_CHARS = 200;
var PROJECT_SCOPE = "project:";
var projectScope = (project) => `${PROJECT_SCOPE}${project.trim()}`.slice(0, SCOPE_CHARS);
var BUILT_IN_STRUCTURES = [
  {
    id: "brief",
    name: "Task brief",
    sections: ["Goal", "Background", "Requirements", "Constraints / out of scope", "Edge cases", "Acceptance criteria", "Assumptions / questions"]
  },
  { id: "steps", name: "Steps", sections: ["Goal", "Steps", "Verify"] }
];
var str = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
var id = (value) => {
  const text = str(value, 40);
  return /^[a-z0-9-]{1,40}$/.test(text) ? text : "";
};
function parseRulesConfig(value) {
  const raw2 = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rules = [];
  for (const item2 of Array.isArray(raw2.rules) ? raw2.rules : []) {
    if (!item2 || typeof item2 !== "object" || Array.isArray(item2)) continue;
    const rule = { id: id(item2.id), text: str(item2.text, MAX_RULE_CHARS), enabled: item2.enabled !== false, scope: str(item2.scope, SCOPE_CHARS) };
    if (rule.id && rule.text && rules.length < MAX_RULES) rules.push(rule);
  }
  const structures = [];
  for (const item2 of Array.isArray(raw2.structures) ? raw2.structures : []) {
    if (!item2 || typeof item2 !== "object" || Array.isArray(item2)) continue;
    const sections = (Array.isArray(item2.sections) ? item2.sections : []).map((section) => str(section, 80)).filter(Boolean).slice(0, MAX_SECTIONS);
    const structure = { id: id(item2.id), name: str(item2.name, 40), sections };
    if (structure.id && structure.name && sections.length > 0 && structures.length < MAX_STRUCTURES) structures.push(structure);
  }
  return { rules, structures };
}
function rulesToJson(config) {
  return {
    rules: config.rules.map((rule) => ({ ...rule })),
    structures: config.structures.map((structure) => ({ ...structure, sections: [...structure.sections] }))
  };
}
function ruleApplies(rule, where) {
  if (!rule.scope) return true;
  if (rule.scope.startsWith(PROJECT_SCOPE)) return where.project !== null && rule.scope === projectScope(where.project);
  return rule.scope === where.workspace;
}
function rulesFor(config, where) {
  return config.rules.filter((rule) => rule.enabled && ruleApplies(rule, where)).map((rule) => rule.text);
}
function structureById(config, structureId) {
  if (!structureId) return null;
  return [...config.structures, ...BUILT_IN_STRUCTURES].find((structure) => structure.id === structureId) ?? null;
}

// src/history.ts
var HISTORY_KEY = "history";
var HISTORY_ENTRY_CHARS = 2e4;
var HISTORY_TOTAL_CHARS = 1e6;
var TRIMMED = "\n\u2026(trimmed in history)";
function trimForHistory(text) {
  return text.length > HISTORY_ENTRY_CHARS ? text.slice(0, HISTORY_ENTRY_CHARS - TRIMMED.length) + TRIMMED : text;
}
function capHistory(list, limit) {
  const out = [];
  let total = 0;
  for (const entry of list.slice(0, Math.max(0, limit))) {
    total += entry.original.length + entry.enhanced.length;
    if (total > HISTORY_TOTAL_CHARS) break;
    out.push(entry);
  }
  return out;
}
function toJson(entry) {
  return { ...entry };
}
function parseHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const out = [];
  for (const item2 of value) {
    if (!item2 || typeof item2 !== "object" || Array.isArray(item2)) {
      continue;
    }
    const { id: id2, at, original, enhanced, style, model, source, project } = item2;
    if (typeof id2 === "string" && typeof at === "number" && typeof original === "string" && typeof enhanced === "string") {
      out.push({
        id: id2,
        at,
        original,
        enhanced,
        style: typeof style === "string" ? style : "balanced",
        model: typeof model === "string" ? model : "",
        source: source === "hook" ? "hook" : "panel",
        ...typeof project === "string" && project.trim() ? { project: project.trim().slice(0, 200) } : {}
      });
    }
  }
  return out;
}

// src/presets.ts
var PRESETS = [
  { id: "copilot", label: "GitHub Copilot", provider: "copilot", baseUrl: "", model: "", env: "" },
  { id: "openai", label: "OpenAI", provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", env: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-haiku-4-5", env: "ANTHROPIC_API_KEY" },
  { id: "openrouter", label: "OpenRouter", provider: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1-mini", env: "OPENROUTER_API_KEY" },
  { id: "gemini", label: "Google Gemini", provider: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", env: "GEMINI_API_KEY" },
  { id: "groq", label: "Groq", provider: "openai", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", env: "GROQ_API_KEY" },
  { id: "deepseek", label: "DeepSeek", provider: "openai", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", env: "DEEPSEEK_API_KEY" },
  { id: "mistral", label: "Mistral", provider: "openai", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", env: "MISTRAL_API_KEY" },
  { id: "ollama", label: "Ollama (local)", provider: "openai", baseUrl: "http://localhost:11434/v1", model: "qwen2.5-coder", env: "" },
  { id: "lmstudio", label: "LM Studio (local)", provider: "openai", baseUrl: "http://localhost:1234/v1", model: "local-model", env: "" },
  { id: "custom", label: "Custom (OpenAI-compatible)", provider: "openai", baseUrl: "", model: "", env: "" },
  // Subscription CLIs: `baseUrl` is unused, `model` is optional (the CLI's default otherwise).
  { id: "claude-code", label: "Claude Code (subscription)", provider: "cli", baseUrl: "", model: "haiku", env: "" },
  { id: "codex", label: "Codex CLI (ChatGPT subscription)", provider: "cli", baseUrl: "", model: "", env: "" },
  { id: "gemini-cli", label: "Gemini CLI (Google account)", provider: "cli", baseUrl: "", model: "", env: "" },
  { id: "custom-cli", label: "Custom CLI (prompt on stdin)", provider: "cli", baseUrl: "", model: "", env: "" }
];
var CUSTOM_PRESET = PRESETS.find((preset) => preset.id === "custom") ?? {
  id: "custom",
  label: "Custom (OpenAI-compatible)",
  provider: "openai",
  baseUrl: "",
  model: "",
  env: ""
};
function presetById(id2) {
  return PRESETS.find((preset) => preset.id === id2) ?? CUSTOM_PRESET;
}
var MODELS_KEY = "models";
var DEFAULT_MAX_TOKENS = 8e3;
var str2 = (value, fallback = "") => typeof value === "string" ? value : fallback;
var num = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
function normalizeProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw2 = value;
  const id2 = str2(raw2.id);
  if (!/^[a-z0-9-]{1,40}$/.test(id2)) {
    return null;
  }
  const preset = presetById(str2(raw2.preset, "custom"));
  return {
    id: id2,
    name: str2(raw2.name).trim().slice(0, 60) || preset.label,
    preset: preset.id,
    provider: preset.provider === "copilot" ? "copilot" : preset.provider === "cli" ? "cli" : raw2.provider === "anthropic" ? "anthropic" : "openai",
    baseUrl: preset.provider === "copilot" ? "" : str2(raw2.baseUrl).trim().slice(0, 500),
    model: str2(raw2.model).trim().slice(0, 200),
    // A profile saved before 2.5.4 also carries `temperature`: it is dropped here, and never sent.
    maxTokens: Math.round(Math.min(32e3, Math.max(128, num(raw2.maxTokens, DEFAULT_MAX_TOKENS)))),
    enabled: raw2.enabled !== false,
    command: preset.provider === "copilot" ? "" : str2(raw2.command).trim().slice(0, 500),
    args: preset.provider === "copilot" ? "" : str2(raw2.args).trim().slice(0, 500)
  };
}
function parseModelsConfig(value) {
  const raw2 = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const list = Array.isArray(raw2.profiles) ? raw2.profiles : [];
  const profiles = [];
  for (const item2 of list) {
    const profile = normalizeProfile(item2);
    if (profile && !profiles.some((existing) => existing.id === profile.id)) {
      profiles.push(profile);
    }
  }
  const ref = (id2) => typeof id2 === "string" && profiles.some((p) => p.id === id2) ? id2 : null;
  return { profiles, hookProfileId: ref(raw2.hookProfileId), selectorProfileId: ref(raw2.selectorProfileId) };
}
function modelsToJson(config) {
  return {
    profiles: config.profiles.map((profile) => ({ ...profile })),
    hookProfileId: config.hookProfileId,
    selectorProfileId: config.selectorProfileId
  };
}
function newProfileId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "model";
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
}
var CONTEXT_LEVELS = ["off", "basic", "standard", "deep", "max"];
function isContextLevel(value) {
  return typeof value === "string" && CONTEXT_LEVELS.includes(value);
}

// src/models.ts
var secretName = (profileId) => `apiKey.${profileId}`;
function envProfiles() {
  const out = [];
  for (const preset of PRESETS) {
    if (preset.env && process.env[preset.env]) {
      out.push({
        id: `env-${preset.id}`,
        name: `${preset.label} (env)`,
        preset: preset.id,
        provider: preset.provider,
        baseUrl: preset.baseUrl,
        model: preset.model,
        maxTokens: DEFAULT_MAX_TOKENS,
        enabled: true,
        command: "",
        args: ""
      });
    }
  }
  return out;
}
async function envKeysAllowed(host) {
  return await host.settings.get("allowEnvKeys").catch(() => true) !== false;
}
async function loadModels(host) {
  const config = parseModelsConfig(await host.storage.get(MODELS_KEY));
  if (config.profiles.length > 0 || !await envKeysAllowed(host)) {
    return { ...config, fromEnv: false };
  }
  return { profiles: envProfiles(), hookProfileId: null, selectorProfileId: null, fromEnv: true };
}
async function saveModels(host, config) {
  await host.storage.set(MODELS_KEY, modelsToJson(config));
}
function needsKey(profile) {
  if (profile.provider === "cli" || profile.provider === "copilot") return false;
  return !(profile.provider === "openai" && isLocalUrl(effectiveBaseUrl(profile)));
}
function effectiveBaseUrl(profile) {
  return profile.baseUrl || presetById(profile.preset).baseUrl;
}
function effectiveModel(profile) {
  if (profile.provider === "cli") return profile.model;
  return profile.model || presetById(profile.preset).model;
}
async function resolveKey(host, profile) {
  if (profile.provider === "copilot") return { key: null, source: "copilot" };
  if (profile.provider === "cli") {
    return { key: null, source: "subscription" };
  }
  if (!needsKey(profile)) {
    const stored2 = await host.secrets.get(secretName(profile.id)).catch(() => null);
    return { key: stored2, source: stored2 ? "secret" : "not-needed" };
  }
  const stored = await host.secrets.get(secretName(profile.id)).catch(() => null);
  if (stored) {
    return { key: stored, source: "secret" };
  }
  const env = presetById(profile.preset).env;
  if (env && process.env[env] && await envKeysAllowed(host)) {
    return { key: process.env[env] ?? null, source: "env" };
  }
  return { key: null, source: "none" };
}
async function viewProfiles(host, profiles) {
  return Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      effectiveBaseUrl: effectiveBaseUrl(profile),
      effectiveModel: effectiveModel(profile),
      keySource: (await resolveKey(host, profile)).source,
      envName: presetById(profile.preset).env
    }))
  );
}
var ChainError = class extends Error {
  code;
  attempts;
  /** The message as a code and parameters, for the panel to show in its language. */
  text;
  constructor(text, code, attempts) {
    super(english(text));
    this.text = text;
    this.code = code;
    this.attempts = attempts;
  }
};
function candidates(profiles, preferredId, fallback) {
  const enabled = profiles.filter((profile) => profile.enabled);
  const preferred = preferredId ? profiles.find((profile) => profile.id === preferredId) : void 0;
  if (preferredId && !preferred) return [];
  const ordered = preferred ? [preferred, ...enabled.filter((p) => p.id !== preferred.id)] : enabled;
  const sameRoute = ordered.filter((profile) => profile.provider === "copilot" === (ordered[0]?.provider === "copilot"));
  return fallback ? sameRoute : sameRoute.slice(0, 1);
}
async function runChain(host, list, system, user, options) {
  const attempts = [];
  if (list.length === 0) {
    throw new ChainError(msg("error.no_model"), "invalid_params", attempts);
  }
  const started = Date.now();
  list = list.filter((profile) => profile.provider === "copilot" === (list[0]?.provider === "copilot"));
  let lastError = null;
  for (const profile of list) {
    if (options.signal?.aborted) {
      break;
    }
    const remaining = options.totalMs === void 0 ? options.timeoutMs : options.totalMs - (Date.now() - started);
    if (remaining <= 50) {
      break;
    }
    const attemptStart = Date.now();
    const model = effectiveModel(profile);
    options.onAttempt?.(profile, model, attempts.length + 1, list.length);
    const { key } = await resolveKey(host, profile);
    if (!key && needsKey(profile)) {
      attempts.push({ profileId: profile.id, name: profile.name, model, ok: false, error: "no API key", errorText: msg("error.no_key"), ms: 0 });
      lastError = new LlmError(msg("error.profile_no_key", { name: profile.name }), "invalid_params");
      continue;
    }
    const controller = new AbortController();
    const last = profile === list[list.length - 1];
    const limit = last && options.totalMs !== void 0 ? remaining : Math.min(options.timeoutMs, remaining);
    let ranOut = false;
    const timer = setTimeout(() => {
      ranOut = true;
      controller.abort();
    }, limit);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);
    try {
      if (profile.provider === "copilot" && await host.settings.get("allowOnlineModelLists") === false) {
        throw new LlmError(msg("error.lists_off"), "unavailable");
      }
      const text2 = profile.provider === "copilot" ? (await host.host.call("copilot.rewrite", { model, system, user, images: (options.images ?? []).map((image) => ({ type: image.type, base64: image.base64 })) }, { signal: controller.signal })).text : profile.provider === "cli" ? await runCli(
        {
          kind: profile.preset,
          command: profile.command,
          model,
          customArgs: profile.args,
          images: imageSupport(profile) === "file" ? (options.images ?? []).map((image) => image.path) : []
        },
        system,
        user,
        controller.signal
      ) : await complete(
        {
          provider: profile.provider,
          baseUrl: effectiveBaseUrl(profile),
          model,
          apiKey: key,
          envName: presetById(profile.preset).env,
          maxTokens: profile.maxTokens
        },
        system,
        user,
        controller.signal,
        imageSupport(profile) === "data" ? (options.images ?? []).map((image) => ({ type: image.type, base64: image.base64 })) : []
      );
      attempts.push({ profileId: profile.id, name: profile.name, model, ok: true, ms: Date.now() - attemptStart });
      return { text: text2, profile, attempts };
    } catch (caught) {
      const error = ranOut && !options.signal?.aborted ? new LlmError(msg("error.model_timeout", { model: model || profile.name, seconds: Math.max(1, Math.round(limit / 1e3)) }), "timeout") : caught;
      lastError = error;
      attempts.push({
        profileId: profile.id,
        name: profile.name,
        model,
        ok: false,
        error: error.message,
        errorText: messageOf(error),
        ms: Date.now() - attemptStart
      });
      if (options.signal?.aborted) {
        break;
      }
      if (options.fallbackOn === "transient" && !isTransient(error)) {
        break;
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
  if (options.signal?.aborted) {
    throw new ChainError(msg("error.cancelled"), "cancelled", attempts);
  }
  const tried = attempts.map((a) => msg("error.attempt", { name: a.name, reason: a.errorText ?? a.error ?? "skipped" }));
  const code = lastError instanceof LlmError ? lastError.code : "action_failed";
  let text = msg("error.out_of_time");
  if (attempts.length > 1) text = msg("error.all_failed", { list: tried });
  else if (lastError) text = messageOf(lastError);
  throw new ChainError(text, code, attempts);
}

// src/prompts.ts
var STYLES = [
  "balanced",
  "concise",
  "detailed",
  "bugfix",
  "feature",
  "refactor",
  "review",
  "plan",
  "custom"
];
var LANGUAGE_NAMES = {
  en: "English",
  vi: "Vietnamese",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ru: "Russian"
};
function isStyle(value) {
  return typeof value === "string" && STYLES.includes(value);
}
var BASE = `You are a prompt engineer for AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode and similar).
Rewrite the user's rough request into a clear, specific, actionable prompt that the agent can execute well.

Rules:
- Preserve the user's intent exactly. Never add features, scope or requirements they did not ask for.
- Ground the prompt in the project context: name the real files, functions, commands and conventions that appear there when they are relevant (e.g. "start in src/auth/session.ts", "verify with pnpm test").
- Never invent facts about the codebase. Mention a file, symbol, API or command only if it appears in the project context or in the request; otherwise tell the agent to locate it. List genuine unknowns under "Assumptions / questions".
- Relevant files in the context are candidates found by search; present them as "likely relevant", not as certain.
- Keep every concrete detail the user gave: names, paths, error messages, code, URLs, numbers.
- Write as instructions addressed to the agent ("Add...", "Investigate..."), not as a conversation.
- Use the project context only to make the prompt more precise; do not summarize it back.
- The agent has the whole project in front of it; you see only what was gathered for you, which can be little or nothing. Write nothing about what you were or were not given, not even as a reason ("no project context was provided, so locate...", "no files were attached"): the agent would take it as a statement about its own project. When a detail is missing, just tell the agent what to find first ("Find the login button and its handler"), or put it under "Assumptions / questions" when only the user can answer; leave out a section that would say nothing else.
- The agent reads the project's own rule files (AGENTS.md, CLAUDE.md, GEMINI.md) by itself. Do not restate them; mention a rule from them only when it changes how this particular task must be done.
- Verification: name only the one or two commands that check this change (from the context), not every check the project has, also for a larger task: the agent finds the rest in the project's rule files.
- Do not decide things the user left open (exact UI wording, translations, names, numbers, design choices): leave them to the agent or list them as questions.
- Match the length to the request: a small change gets a short prompt; never pad.
- Keep the reason the user gave for the request, and give the reason behind any constraint that is not obvious in a short clause ("..., because ..."). Never invent a reason.
- Phrase instructions as what to do ("keep the change inside src/auth") rather than what not to do; keep a "do not" only for a real hard limit. A hard limit says exactly what it covers and why, with any exception in the same sentence ("ask before changing the production database; the test database needs no approval"). Avoid a bare "never" or "always": agents apply such rules as written and then hold back routine work.
- Use a calm, plain tone: no capitals for emphasis, no MUST / IMPORTANT / CRITICAL, no "be thorough" or "double-check everything". Current agents follow plain instructions, and shouting makes them over-react.
- Say when the agent should stop and ask: only for a blocking unknown or an action that is hard to undo. Name the actions that apply to this task (deleting data, force-pushing, publishing, changing shared systems) instead of a general "ask before anything risky". Otherwise it picks the most reasonable option, states it as an assumption and carries on. When the request itself approves an action ("run the migration on staging"), write it as approved.
- Ask for evidence at the end: the agent reports the commands it ran and what they printed (or what it observed), not just "it works".
- Leave the agent's way of working to the agent unless the user asked otherwise: no "think step by step" or "think hard", no request to show or write out its reasoning (the model's safety checks can refuse that; ask for findings and evidence instead), no token or time budget, and no instruction to delegate to subagents.
- Keep the instructions consistent: never give two that pull against each other (for example "wait for my confirmation" and "proceed without asking"); pick one.
- When the request has <attached_images>, they are screenshots or pictures the user attached. If you can see them, use what they show (error text, layout, values) to make the prompt precise. Always tell the agent to open each image by its exact path, and never describe what you cannot see.
- Output just the final prompt text, starting with its first line: no preamble, no explanation, no surrounding code fence.

Larger tasks. When the task has several steps or touches several files, the prompt also says these three things, each in a sentence or two of its own words, placed where they fit the shape (for example with the constraints and at the end):
1. Finish all of it. Include these two sentences, in the prompt's language, as the last lines of the constraints (in a shape without such a section, as a short paragraph of their own before the reporting): "Complete every part of this task before you end your turn. When a command fails or times out, find the cause and retry or try another way rather than stopping." Agents otherwise tend to stop part-way with a list of what remains or an offer to continue, and a prompt for a larger task that lacks these two sentences is not finished: check that they are there before you answer. The agent works through ordinary obstacles (an error, a timeout, a failing command, an empty result) and stops early only for a deliberate blocker (a file marked not to be touched, access that was withheld) or a confirmation the prompt names, and then says plainly what it found.
2. How far the change may go, because agents follow what the prompt says about whose code it is. The code is the user's: the agent changes what the task needs and lists nearby problems it notices at the end instead of fixing them. Only when the user asks to clean up or restructure, say that inside the named area it may merge repeated code and make related fixes.
3. Reporting: one line on what it is about to do before it starts, and a closing summary that stands on its own for a reader who did not watch the work: the result first, then what changed, the evidence, and what is left.
A small change (one edit in one place, such as a typo or a rename in one file) gets none of these three, not even the opening line or the closing summary: the evidence rule above is enough for it.`;
var STYLE_RULES = {
  balanced: `Shape: a one-line goal, then short sections only where useful: Context, Requirements, Constraints, Done when. Keep it compact; small requests stay small.`,
  concise: `Shape: a tight, unambiguous prompt of at most four lines, each a single sentence of at most about 25 words (about 500 characters in all). The first line is the task; the lines after it say only what the agent could not work out from the project itself. Fix grammar and vagueness; remove filler. No sections or headings; add one open question only if it blocks the task. The last line names the one command that checks the change and asks for its output, in one sentence. Brevity wins here: apply the other rules in as few words as possible, and leave out reasons, assumptions, anything the project's rule files already say, files and search hints the agent can find itself, things to leave alone that the request did not mention, and the "Larger tasks" additions.`,
  detailed: `Shape: a full spec with sections: Goal, Background, Requirements (numbered), Constraints / non-goals, Edge cases, Acceptance criteria, Deliverables. Be thorough but do not pad.`,
  bugfix: `Shape: a bug-fix brief: Symptom (actual vs expected), Reproduction steps (if known), Suspected area (only if given), Investigation steps (find the root cause before changing code), Fix requirements (minimal change, no unrelated refactors; other problems found on the way are reported, not fixed), Verification (add or update a regression test, run the relevant tests).`,
  feature: `Shape: a feature brief: Goal and user value, Behaviour / requirements, UI or API surface (if relevant), Constraints (match existing patterns, no new dependencies unless needed), Tests to add, Done when.`,
  refactor: `Shape: a refactor brief: Target code, Motivation, Desired structure, Scope (inside the target code the agent may merge repeated code and reshape it as it sees fit; code outside it stays as it is), Hard constraint that behaviour must not change, Steps in small safe increments, Verification (existing tests pass; add tests first if coverage is missing).`,
  review: `Shape: a code-review request: What to review (diff, branch or files), Focus areas (correctness, edge cases, security, performance, readability, tests), Output format (findings grouped by severity with file:line and a suggested fix). Tell the agent not to modify code unless asked.`,
  plan: `Shape: ask the agent to plan before coding: first explore the relevant code and write a short step-by-step plan with risks and open questions, then wait for confirmation (or proceed if the plan is low-risk, say which). Include the goal and requirements.`,
  custom: `Follow the custom instructions below for the shape and content of the prompt.`
};
var AGENT_HINTS = [
  {
    match: /copilot/i,
    hint: "Target is GitHub Copilot in the attached project: state the requested change, relevant paths, acceptance criteria and verification commands. Do not assume a separate terminal agent or claim the project is unavailable."
  },
  {
    match: /claude/i,
    hint: "Target is Claude Code: write sections as Markdown headings (do not mix in XML tags) and state the exact verification command. Leave how it plans and tracks the work to it."
  },
  {
    match: /codex/i,
    hint: "Target is OpenAI Codex CLI: prefer short imperative bullet points, explicit file paths and the exact test/lint command to run; avoid long prose."
  },
  {
    match: /gemini/i,
    hint: "Target is Gemini CLI: clear numbered steps, explicit file paths, and what to verify at the end."
  },
  {
    match: /aider/i,
    hint: "Target is Aider: name the files to add to the chat first, then the change; keep it concise."
  },
  {
    match: /opencode|amp|cursor|droid|pi\b|qwen|kimi|goose|cline/i,
    hint: "Target is a terminal coding agent: explicit file paths, clear steps, exact verification command."
  }
];
function agentHint(agent) {
  if (!agent) return null;
  return AGENT_HINTS.find((entry) => entry.match.test(agent))?.hint ?? null;
}
function buildSystemPrompt(options) {
  const sections = options.structure?.sections.filter((section) => section.trim()) ?? [];
  const shape = sections.length > 0 ? structureShape(sections) : STYLE_RULES[options.style];
  const parts = [BASE, shape];
  const hint = agentHint(options.agent);
  if (hint) {
    parts.push(hint);
  }
  const lang = LANGUAGE_NAMES[options.language];
  parts.push(
    lang ? `Write the final prompt in ${lang}, but keep code, identifiers, paths and error messages verbatim.` : `Write the final prompt in the same language as the user's request; keep code, identifiers, paths and error messages verbatim.`
  );
  const custom = options.customInstructions?.trim();
  if (custom) {
    parts.push(`Custom instructions from the user (follow them):
${custom}`);
  }
  const rules = (options.rules ?? []).map((rule) => rule.trim()).filter(Boolean);
  if (rules.length > 0) {
    parts.push(`Rules from the user (always follow them; they win over the shape above):
${rules.map((rule) => `- ${rule}`).join("\n")}`);
  }
  return parts.join("\n\n");
}
function structureShape(sections) {
  return [
    "Shape: write the prompt under exactly these headings, in this order:",
    ...sections.map((section, index) => `${index + 1}. ${section}`),
    "Use the headings as given, translated into the output language when they are in another language. Add no other headings: put open questions or assumptions under the closest heading. Leave a heading out only when nothing in the request or the context belongs under it; never invent content to fill one."
  ].join("\n");
}
var escapeAttr = (value) => value.replace(/["<>&]/g, (c) => ({ '"': "&quot;", "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
function buildUserMessage(prompt, context = []) {
  const sections = context.map((block) => {
    const note = block.note ? ` note="${escapeAttr(block.note)}"` : "";
    return `<item kind="${block.kind}" label="${escapeAttr(block.label)}"${note}>
${block.content}
</item>`;
  });
  const contextBlock = sections.length > 0 ? `<project_context>
${sections.join("\n\n")}
</project_context>

` : "";
  return `${contextBlock}<request>
${prompt.trim()}
</request>

Rewrite the request above into the final prompt.`;
}
function cleanOutput(text) {
  let out = text.trim();
  out = out.replace(/^(here(?:'s| is)[^\n]*?(?:prompt|version)[^\n]*:)\s*\n/i, "");
  const fence = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(out.trim());
  if (fence) {
    out = fence[1];
  }
  out = out.replace(/^<\/?(?:request|prompt|final_prompt)>\s*/i, "").replace(/\s*<\/(?:request|prompt|final_prompt)>$/i, "");
  return out.trim();
}
var SEND_CHUNK = 4e3;
function terminalChunks(text, mode, max = SEND_CHUNK) {
  const formatted = formatForTerminal(text, mode);
  if (formatted.length <= max) return formatted ? [formatted] : [];
  const pasted = formatted.startsWith(PASTE_START) && formatted.endsWith(PASTE_END);
  const body = pasted ? formatted.slice(PASTE_START.length, -PASTE_END.length) : formatted;
  const room = max - (pasted ? PASTE_END.length : 0);
  const pieces = [];
  let at = 0;
  while (at < body.length) {
    const limit = pieces.length === 0 && pasted ? room - PASTE_START.length : room;
    if (body.length - at <= limit) {
      pieces.push(body.slice(at));
      break;
    }
    let cut = body.lastIndexOf("\n", at + limit - 1) + 1 - at;
    if (cut < limit * 0.6) cut = limit;
    if (isHighSurrogate(body.charCodeAt(at + cut - 1)) && cut > 1) cut -= 1;
    pieces.push(body.slice(at, at + cut));
    at += cut;
  }
  if (pasted) {
    pieces[0] = PASTE_START + pieces[0];
    pieces[pieces.length - 1] = pieces[pieces.length - 1] + PASTE_END;
  }
  return pieces;
}
var PASTE_START = "\x1B[200~";
var PASTE_END = "\x1B[201~";
var isHighSurrogate = (code) => code >= 55296 && code <= 56319;
function terminalSafe(text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  let out = "";
  let kept = 0;
  for (let index = 0; index < normalized.length; index++) {
    const code = normalized.charCodeAt(index);
    const control = code < 32 && code !== 10 && code !== 9 || code >= 127 && code <= 159;
    if (control) {
      out += normalized.slice(kept, index);
      kept = index + 1;
    }
  }
  return kept === 0 ? normalized : out + normalized.slice(kept);
}
function formatForTerminal(text, mode) {
  const normalized = terminalSafe(text).trim();
  if (mode === "single-line") {
    return normalized.split("\n").map((line) => line.trim()).filter(Boolean).join(" ");
  }
  if (mode === "raw" || !normalized.includes("\n")) {
    return normalized;
  }
  return `${PASTE_START}${normalized}${PASTE_END}`;
}

// src/protocol.ts
var PANEL_REQUEST_LIMIT_MS = 12e4;

// src/privacy.ts
var PRIVACY_KEYS = [
  "allowProjectFiles",
  "allowGit",
  "allowTerminalRead",
  "allowOtherAgents",
  "allowAgentActivity",
  "allowEditorSaves",
  "allowTerminalSend",
  "allowAgentLaunch",
  "allowOpenFiles",
  "saveHistory",
  "allowEnvKeys",
  "allowOnlineModelLists"
];
var OFF_BY_DEFAULT = /* @__PURE__ */ new Set(["allowOtherAgents", "allowAgentActivity", "allowEditorSaves", "allowAgentLaunch"]);
var NEEDS_CONSENT = /* @__PURE__ */ new Set(["allowOtherAgents", "allowAgentActivity", "allowAgentLaunch"]);
var CONSENTS_KEY = "consents";
function parseConsents(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const key of NEEDS_CONSENT) if (value[key] === true) out[key] = true;
  return out;
}
function parsePrivacy(settings, consents) {
  const out = {};
  for (const key of PRIVACY_KEYS) {
    const on = OFF_BY_DEFAULT.has(key) ? settings[key] === true : settings[key] !== false;
    out[key] = consents && NEEDS_CONSENT.has(key) ? on && consents[key] === true : on;
  }
  return out;
}
var OTHER_AGENTS_LIMITS = {
  agents: { key: "otherAgentsMax", min: 1, max: 8, default: 4 },
  lines: { key: "otherAgentsLines", min: 10, max: 300, default: 80 }
};
function clampSetting(value, spec) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, Math.round(number)));
}
function parseOtherAgentsLimits(settings) {
  return {
    agents: clampSetting(settings[OTHER_AGENTS_LIMITS.agents.key], OTHER_AGENTS_LIMITS.agents),
    lines: clampSetting(settings[OTHER_AGENTS_LIMITS.lines.key], OTHER_AGENTS_LIMITS.lines)
  };
}

// src/progress.ts
var RANK = { off: 0, basic: 1, standard: 2, deep: 3, max: 4 };
function planSteps(level, allowProjectFiles, readsOtherAgents = false) {
  const steps = [];
  if (RANK[level] >= RANK.basic) steps.push("workspace");
  if (RANK[level] >= RANK.standard && allowProjectFiles) steps.push("project");
  if (RANK[level] >= RANK.deep && allowProjectFiles) steps.push("git", "search");
  if (RANK[level] >= RANK.max) {
    if (allowProjectFiles) steps.push("pick");
    steps.push("terminal");
    if (readsOtherAgents) steps.push("agents");
  }
  steps.push("model");
  return steps;
}
var ESTIMATE_CAP = 95;
var ESTIMATE_SLOW = { share: ESTIMATE_CAP - 60, tauMs: 9e4 };
function createProgress(runId, keys, send, clock = Date.now) {
  const startedAt = clock();
  const steps = keys.map((key) => ({ key, status: "pending" }));
  send({ runId, startedAt, steps: steps.map((step) => ({ ...step })) });
  return (key, status, detail, fraction) => {
    let step = steps.find((entry) => entry.key === key);
    if (!step) {
      step = { key, status: "pending" };
      steps.splice(Math.max(0, steps.length - 1), 0, step);
    }
    if (status === "running" && step.startedAt === void 0) step.startedAt = clock();
    step.status = status;
    if (detail !== void 0) step.detail = detail;
    if (status === "done" || status === "skipped") delete step.fraction;
    else if (fraction !== void 0) step.fraction = Math.min(1, Math.max(0, fraction));
    send({ runId, startedAt, steps: steps.map((entry) => ({ ...entry })) });
  };
}

// src/brand.ts
var BRAND = "Enhance Prompt";
var BRAND_SHORT = "Enhance";

// src/worker.ts
var AUTO_MODES = ["off", "rules", "ai"];
var HOOK_BUDGET_MS = 1700;
var RUN_LIMITS = { budgetMs: PANEL_REQUEST_LIMIT_MS - 5e3, pickerMs: 25e3, sliceMs: 9e4, totalMs: 3e5, orphanMs: 1e4 };
var CATALOG_TTL_MS = 24 * 36e5;
var str3 = (value, fallback = "") => typeof value === "string" ? value : fallback;
var num2 = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
var bool = (value, fallback) => typeof value === "boolean" ? value : fallback;
async function readSettings(host) {
  const [all, consents] = await Promise.all([host.settings.get(), host.storage.get(CONSENTS_KEY).catch(() => null)]);
  const mode = str3(all.autoEnhanceMode, "off");
  const style = str3(all.defaultStyle, "balanced");
  const level = str3(all.contextLevel, "standard");
  return {
    defaultStyle: isStyle(style) ? style : "balanced",
    outputLanguage: str3(all.outputLanguage, "auto"),
    customInstructions: str3(all.customInstructions),
    contextLevel: isContextLevel(level) ? level : "standard",
    terminalLines: num2(all.terminalLines, 100),
    extraContextFiles: str3(all.extraContextFiles).split("\n").map((line) => line.trim().replace(/\\/g, "/").replace(/^\.\//, "")).filter((line) => line && !line.startsWith("/") && !line.includes("..")).slice(0, 10),
    excludePatterns: str3(all.excludePatterns),
    adaptToAgent: bool(all.adaptToAgent, true),
    fallbackEnabled: bool(all.fallbackEnabled, true),
    fallbackOn: str3(all.fallbackOn) === "transient" ? "transient" : "any",
    timeoutSeconds: num2(all.timeoutSeconds, 60),
    sendMode: str3(all.sendMode, "paste"),
    sendPressEnter: bool(all.sendPressEnter, false),
    historyLimit: num2(all.historyLimit, 50),
    autoEnhanceMode: AUTO_MODES.includes(mode) ? mode : "off",
    autoEnhanceAppend: str3(all.autoEnhanceAppend),
    autoEnhanceMinLength: num2(all.autoEnhanceMinLength, 8),
    autoEnhanceContext: bool(all.autoEnhanceContext, true),
    notifyWhenDone: bool(all.notifyWhenDone, false),
    otherAgentsLimits: parseOtherAgentsLimits(all),
    uiLanguage: str3(all.uiLanguage, "auto"),
    privacy: parsePrivacy(all, parseConsents(consents))
  };
}
function hostError(text, code) {
  return Object.assign(new Error(withMessage(text)), { code, text });
}
function chainOptions(settings, signal, extra = {}) {
  return {
    signal,
    timeoutMs: settings.timeoutSeconds * 1e3,
    fallback: settings.fallbackEnabled,
    fallbackOn: settings.fallbackOn,
    ...extra
  };
}
var historyQueue = Promise.resolve();
function withHistory(change) {
  const next = historyQueue.then(change, change);
  historyQueue = next.catch(() => void 0);
  return next;
}
function historyChange(host, change) {
  return withHistory(() => host.storage.transaction ? host.storage.transaction(change) : change());
}
async function blockedAgent(host, terminalId) {
  const list = await host.host.call("agents.list", {}).catch(() => null);
  const agent = (list?.agents ?? []).find((entry) => entry.terminalId === terminalId);
  return agent?.state === "blocked" ? agent.title ?? agent.agent ?? "agent" : null;
}
var UNDO_MS = 6e4;
var UNDO_KEPT = 10;
var removedEntries = /* @__PURE__ */ new Map();
async function addHistory(host, settings, entry) {
  if (settings.historyLimit <= 0 || !settings.privacy.saveHistory) return;
  await historyChange(host, async () => {
    const list = parseHistory(await host.storage.get(HISTORY_KEY));
    const at = Date.now();
    const added = {
      id: `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at,
      ...entry,
      original: trimForHistory(entry.original),
      enhanced: trimForHistory(entry.enhanced)
    };
    const next = capHistory([added, ...list], settings.historyLimit);
    await host.storage.set(HISTORY_KEY, next.map(toJson));
  });
}
async function pickFilesWithModel(host, config, settings, tree, prompt, signal, totalMs = RUN_LIMITS.pickerMs) {
  const system = "You pick source files relevant to a coding task. Answer ONLY a JSON array of up to 8 file paths copied exactly from the list, most relevant first. No prose.";
  const user = `<task>
${prompt}
</task>
<files>
${tree.join("\n")}
</files>`;
  const list = candidates(config.profiles, config.selectorProfileId, settings.fallbackEnabled);
  const { text } = await runChain(host, list, system, user, chainOptions(settings, signal, { timeoutMs: RUN_LIMITS.pickerMs, totalMs }));
  const match = /\[[\s\S]*\]/.exec(text);
  if (!match) return [];
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string").slice(0, 8) : [];
}
async function ownRules(host, hint) {
  const config = parseRulesConfig(await host.storage.get(RULES_KEY).catch(() => null));
  const where = await focusedProject(host, hint);
  return { config, rules: rulesFor(config, where), where };
}
function withAttachedPaths(prompt, paths) {
  const missing = paths.filter((path) => !prompt.includes(path));
  return missing.length === 0 ? prompt : `${prompt.trimEnd()}

Attached files (open them):
${missing.map((path) => `- ${path}`).join("\n")}`;
}
function gatherPrivacy(settings) {
  const otherAgents2 = settings.privacy.allowTerminalRead && settings.privacy.allowOtherAgents;
  return {
    allowGit: settings.privacy.allowGit,
    allowTerminal: settings.privacy.allowTerminalRead,
    allowOtherAgents: otherAgents2,
    // The amounts matter only while the switch is on (and confirmed).
    ...otherAgents2 ? { otherAgentsLimits: settings.otherAgentsLimits } : {},
    allowAgentActivity: settings.privacy.allowAgentActivity,
    allowEditorSaves: settings.privacy.allowEditorSaves
  };
}
function allowedLevel(requested, settings) {
  return !settings.privacy.allowProjectFiles && atLeast(requested, "standard") ? "basic" : requested;
}
var PROJECT_FILES_OFF = msg("note.project_files_off");
async function enhance(host, input, signal, progress, budgetMs) {
  const deadline2 = budgetMs === void 0 ? void 0 : Date.now() + budgetMs;
  const left = () => deadline2 === void 0 ? void 0 : Math.max(0, deadline2 - Date.now());
  const prompt = input.prompt.trim();
  if (!prompt) throw hostError(msg("error.no_prompt"), "invalid_params");
  const settings = await readSettings(host);
  const config = await loadModels(host);
  const chosenModel = input.model?.trim().slice(0, 200);
  const list = candidates(config.profiles, input.profileId ?? null, settings.fallbackEnabled).map(
    (profile) => chosenModel && profile.id === input.profileId ? { ...profile, model: chosenModel } : profile
  );
  if (list.length === 0) throw hostError(msg("error.no_model"), "invalid_params");
  const pickerProfiles = config.profiles.filter((profile) => profile.provider === "copilot" === (list[0]?.provider === "copilot"));
  const pickerConfig = {
    ...config,
    profiles: pickerProfiles.map((profile) => list.find((candidate) => candidate.id === profile.id) ?? profile),
    selectorProfileId: pickerProfiles.some((profile) => profile.id === config.selectorProfileId) ? config.selectorProfileId : list[0]?.id ?? null
  };
  const style = isStyle(input.style) ? input.style : settings.defaultStyle;
  const requested = isContextLevel(input.level) ? input.level : settings.contextLevel;
  const level = allowedLevel(requested, settings);
  const privacy = gatherPrivacy(settings);
  const step = progress?.(level, settings.privacy.allowProjectFiles, privacy.allowOtherAgents) ?? (() => void 0);
  const own = await ownRules(host, typeof input.workspaceId === "string" ? input.workspaceId : null);
  const gathered = await gatherContext(host, {
    level,
    prompt,
    terminalId: input.terminalId ?? null,
    terminalLines: settings.terminalLines,
    exclude: new Set(input.exclude ?? []),
    extraFiles: settings.extraContextFiles,
    excludePatterns: settings.excludePatterns,
    // The picker gets its own share, so the rewrite itself always has time left.
    pickFiles: (tree, task) => pickFilesWithModel(host, pickerConfig, settings, tree, task, signal, Math.min(RUN_LIMITS.pickerMs, (left() ?? Infinity) / 2)),
    ...privacy,
    onStep: step,
    signal,
    workspaceId: typeof input.workspaceId === "string" ? input.workspaceId : null
  });
  if (level !== requested) gathered.notes.push(PROJECT_FILES_OFF);
  const agentItem = gathered.items.find((entry) => entry.kind === "agent");
  const language = input.language && /^[a-z]{2,4}$/.test(input.language) ? input.language : settings.outputLanguage;
  const system = buildSystemPrompt({
    style,
    language,
    customInstructions: settings.customInstructions,
    agent: settings.adaptToAgent ? agentItem?.content.split(" ")[0] ?? null : null,
    rules: own.rules,
    structure: structureById(own.config, input.structureId)
  });
  const files = await loadFiles((input.files ?? []).filter((path) => typeof path === "string" && path.trim())).catch((error) => {
    if (error instanceof LlmError) throw hostError(error.text, error.code);
    throw error;
  });
  const images = files.images;
  const excluded = new Set(input.exclude ?? []);
  const attachedTexts = files.texts.map((file) => contextItem(attachmentItemId(file.path), "file", raw(file.name), file.content, file.cut > 0 ? msg("why.trimmed") : void 0)).filter((entry) => !excluded.has(entry.id));
  if (attachedTexts.length > 0) gathered.items = [...attachedTexts, ...gathered.items];
  const otherFiles = files.paths.filter((path) => !images.some((image) => image.path === path));
  const user = [buildUserMessage(prompt, gathered.items), imagesBlock(images), otherFiles.length > 0 ? `<attached_files>
${otherFiles.map((path, index) => `${index + 1}. ${path}`).join("\n")}
</attached_files>` : ""].filter(Boolean).join("\n\n");
  let tried = "";
  try {
    const result = await runChain(
      host,
      list,
      system,
      user,
      chainOptions(settings, signal, {
        ...deadline2 === void 0 ? {} : { totalMs: left() },
        images,
        onAttempt: (profile, model, attempt, total) => {
          tried = `${profile.name} \xB7 ${model || "default"}${attempt > 1 ? ` \xB7 ${attempt}/${total}` : ""}`;
          step("model", "running", tried);
        }
      })
    );
    step("model", "done", `${result.profile.name} \xB7 ${result.attempts.find((attempt) => attempt.ok)?.model ?? ""}`);
    if (images.length > 0 && imageSupport(result.profile) === "none") gathered.notes.push(msg("note.images_paths_only"));
    return {
      enhanced: withAttachedPaths(withImagePaths(cleanOutput(result.text), images), otherFiles),
      profile: result.profile,
      attempts: result.attempts,
      items: gathered.items,
      notes: gathered.notes,
      settings,
      style,
      project: own.where.project
    };
  } catch (error) {
    step("model", "failed", tried || void 0);
    if (error instanceof ChainError) {
      const slow = error.attempts.length > 0 && error.attempts.every((attempt) => attempt.errorText?.code === "error.model_timeout");
      throw hostError(slow ? msg("error.too_slow", { reason: error.text }) : error.text, error.code);
    }
    throw error;
  }
}
var view = (items) => items.map(({ content: _content, ...rest }) => rest);
async function modelsView(host) {
  const config = await loadModels(host);
  const keys = host.host.has("secrets.protection") ? await host.host.call("secrets.protection", {}).catch(() => null) : null;
  return {
    profiles: await viewProfiles(host, config.profiles),
    hookProfileId: config.hookProfileId,
    selectorProfileId: config.selectorProfileId,
    fromEnv: config.fromEnv,
    presets: PRESETS,
    ...keys?.status === "unavailable" ? { keysUnavailable: true } : {}
  };
}
async function editableModels(host) {
  const { fromEnv: _fromEnv, ...config } = await loadModels(host);
  return config;
}
async function hookPlace(host, terminalId) {
  const focused = await host.host.call("workspace.readContext", {}).catch(() => null);
  const own = await workspaceOfTerminal(host, terminalId, focused);
  if (own) {
    return {
      workspace: own,
      label: `${workspaceTitle(own.name, own.project)}${own.branch ? ` (branch ${own.branch})` : ""}`,
      where: { workspace: own.name, project: own.project?.trim() || own.name }
    };
  }
  if (!focused || !focused.terminals.some((terminal) => terminal.id === terminalId)) return null;
  const workspace = await findFocusedWorkspace(host, focused);
  return {
    workspace,
    label: `${workspaceTitle(focused.displayName, workspace?.project)}${focused.branch ? ` (branch ${focused.branch})` : ""}`,
    where: { workspace: focused.displayName, project: await projectNameOf(host, focused, workspace) }
  };
}
function hookContext(place, allowProjectFiles) {
  if (!place) return [];
  const items = [{ id: "workspace", kind: "workspace", label: "Workspace", content: place.label, chars: place.label.length }];
  if (!allowProjectFiles) return items;
  const cached = place.workspace && isLocalWorkspace(place.workspace) ? cachedStatic(place.workspace.path) : null;
  if (cached) items.push(...cached.items.filter((entry) => entry.kind !== "tree"));
  return items;
}
var SIDEBAR_KEY = process.platform === "darwin" ? "\u2318L" : "Ctrl+L";
var statusBarText = (mode) => `${BRAND_SHORT}: ${mode === "off" ? "Off" : "On"}`;
var WORKER_WORDS = {
  en: {
    modes: { off: "off", rules: "on (rules)", ai: "on (AI)" },
    tooltip: (mode) => `Click: open the right sidebar (${SIDEBAR_KEY}), then the lightbulb tab "${BRAND}".
Auto-enhance is ${mode}. Change it under the panel's gear icon or in the command palette.
Settings and updates: Settings \u2192 Plugins \u2192 Enhance Prompt.`,
    answer: (mode) => `Auto-enhance is ${mode}.`,
    bar: { hidden: "Status bar item hidden.", shown: "Status bar item shown." }
  },
  vi: {
    modes: { off: "t\u1EAFt", rules: "b\u1EADt (quy t\u1EAFc)", ai: "b\u1EADt (AI)" },
    tooltip: (mode) => `B\u1EA5m: m\u1EDF thanh b\xEAn ph\u1EA3i (${SIDEBAR_KEY}), r\u1ED3i ch\u1ECDn tab b\xF3ng \u0111\xE8n "${BRAND}".
T\u1EF1 c\u1EA3i thi\u1EC7n \u0111ang ${mode}. \u0110\u1ED5i \u1EDF bi\u1EC3u t\u01B0\u1EE3ng b\xE1nh r\u0103ng c\u1EE7a panel ho\u1EB7c trong command palette.
C\xE0i \u0111\u1EB7t v\xE0 c\u1EADp nh\u1EADt: Settings \u2192 Plugins \u2192 Enhance Prompt.`,
    answer: (mode) => `T\u1EF1 c\u1EA3i thi\u1EC7n \u0111ang ${mode}.`,
    bar: { hidden: "\u0110\xE3 \u1EA9n m\u1EE5c tr\xEAn thanh tr\u1EA1ng th\xE1i.", shown: "\u0110\xE3 hi\u1EC7n m\u1EE5c tr\xEAn thanh tr\u1EA1ng th\xE1i." }
  },
  zh: {
    modes: { off: "\u5173", rules: "\u5F00\uFF08\u89C4\u5219\uFF09", ai: "\u5F00\uFF08AI\uFF09" },
    tooltip: (mode) => `\u70B9\u51FB\uFF1A\u6253\u5F00\u53F3\u4FA7\u8FB9\u680F\uFF08${SIDEBAR_KEY}\uFF09\uFF0C\u518D\u9009\u706F\u6CE1\u6807\u7B7E \u201C${BRAND}\u201D\u3002
\u81EA\u52A8\u4F18\u5316\uFF1A${mode}\u3002\u53EF\u5728\u9762\u677F\u7684\u9F7F\u8F6E\u56FE\u6807\u4E0B\u6216\u547D\u4EE4\u9762\u677F\u4E2D\u66F4\u6539\u3002
\u8BBE\u7F6E\u4E0E\u66F4\u65B0\uFF1ASettings \u2192 Plugins \u2192 Enhance Prompt\u3002`,
    answer: (mode) => `\u81EA\u52A8\u4F18\u5316\uFF1A${mode}\u3002`,
    bar: { hidden: "\u72B6\u6001\u680F\u9879\u76EE\u5DF2\u9690\u85CF\u3002", shown: "\u72B6\u6001\u680F\u9879\u76EE\u5DF2\u663E\u793A\u3002" }
  }
};
var LOCALE_KEY = "uiLocale";
async function workerLanguage(host, setting) {
  const chosen = setting ?? (await host.settings.get()).uiLanguage;
  const value = typeof chosen === "string" ? chosen : "auto";
  if (value === "en" || value === "vi" || value === "zh") return value;
  const locale = await host.storage.get(LOCALE_KEY).catch(() => null);
  return resolveLanguage("auto", typeof locale === "string" ? locale : "en");
}
async function workerWords(host) {
  return WORKER_WORDS[await workerLanguage(host)] ?? WORKER_WORDS.en;
}
async function modeAnswer(host, mode) {
  const words = await workerWords(host);
  return words.answer(words.modes[mode]);
}
async function refreshStatusBar(host) {
  if (!host.host.has("statusBar.update")) return;
  const all = await host.settings.get();
  const { autoEnhanceMode } = await readSettings(host);
  const display = typeof all.statusBarItem === "string" ? all.statusBarItem : "full";
  const words = await workerWords(host);
  await host.host.call("statusBar.update", {
    id: "auto-enhance",
    visible: display !== "hidden",
    text: display === "icon" ? "" : statusBarText(autoEnhanceMode),
    icon: "lightbulb",
    tone: autoEnhanceMode === "off" ? "neutral" : "accent",
    tooltip: words.tooltip(words.modes[autoEnhanceMode])
  }).catch(() => void 0);
}
async function setMode(host, mode) {
  await host.settings.set("autoEnhanceMode", mode);
  await refreshStatusBar(host);
  return modeAnswer(host, mode);
}
async function sendPieces(host, terminalId, pieces) {
  const pasting = pieces.length > 1 && pieces[0].startsWith(PASTE_START) && pieces[pieces.length - 1].endsWith(PASTE_END);
  let sent = 0;
  try {
    for (const piece of pieces) {
      const result = await host.host.call("terminal.sendText", { terminalId, text: piece });
      if (!result.accepted) break;
      sent++;
    }
  } finally {
    if (pasting && sent > 0 && sent < pieces.length) {
      await host.host.call("terminal.sendText", { terminalId, text: PASTE_END }).catch(() => void 0);
    }
  }
  return { accepted: sent === pieces.length };
}
async function fetchCatalog(host, source) {
  const { privacy } = await readSettings(host);
  const online = privacy.allowOnlineModelLists;
  if (source.presetId === "claude-code") return claudeCatalog(source.command, online);
  if (source.presetId === "codex") return codexCatalog(source.command);
  if (source.presetId === "gemini-cli") return geminiCatalog(source.command, online);
  if (source.provider === "cli") return { models: [], source: "custom CLI", fetchedAt: Date.now() };
  if (!online) return { models: [], source: "GET /models", fetchedAt: Date.now(), error: english(msg("error.lists_off")), errorText: msg("error.lists_off") };
  const envKey = privacy.allowEnvKeys && source.env ? process.env[source.env] ?? null : null;
  const savedKey = source.profile ? (await resolveKey(host, source.profile)).key : null;
  return apiCatalog(source.provider === "anthropic" ? "anthropic" : "openai", source.baseUrl, source.typedKey || savedKey || envKey);
}
var latestProgress = /* @__PURE__ */ new Map();
var MAX_TRACKED_RUNS = 20;
function progressOf(runId) {
  return latestProgress.get(runId) ?? null;
}
var liveRuns = /* @__PURE__ */ new Map();
var unnamedRuns = 0;
function startRun(host, input, panelId, budgetMs) {
  const runId = typeof input.runId === "string" ? input.runId.slice(0, 64) : "";
  const progress = runId ? (level, allowProjectFiles, readsOtherAgents) => createProgress(runId, planSteps(level, allowProjectFiles, readsOtherAgents), (snapshot) => {
    latestProgress.delete(runId);
    latestProgress.set(runId, snapshot);
    for (const old of [...latestProgress.keys()].slice(0, Math.max(0, latestProgress.size - MAX_TRACKED_RUNS))) latestProgress.delete(old);
    host.panels.post("enhance.progress", snapshot, { panel: panelId });
  }) : void 0;
  const stop = new AbortController();
  const run2 = {
    id: runId || `unnamed-${++unnamedRuns}`,
    key: JSON.stringify([panelId, runId || `unnamed-${unnamedRuns}`]),
    panelId,
    input,
    started: Date.now(),
    stop,
    waiting: 0,
    orphan: null,
    outcome: enhance(host, input, stop.signal, progress, budgetMs).then(
      (result) => ({ ok: true, result }),
      (error) => ({ ok: false, error })
    )
  };
  liveRuns.get(run2.key)?.stop.abort();
  liveRuns.set(run2.key, run2);
  return run2;
}
function endRun(run2) {
  if (run2.orphan) clearTimeout(run2.orphan);
  run2.orphan = null;
  if (liveRuns.get(run2.key) === run2) liveRuns.delete(run2.key);
}
async function waitForRun(host, run2, signal, sliceMs) {
  if (run2.orphan) clearTimeout(run2.orphan);
  run2.orphan = null;
  run2.waiting += 1;
  let slice = null;
  let onAbort = null;
  try {
    const first = await Promise.race([
      run2.outcome,
      ...sliceMs === null ? [] : [new Promise((resolve3) => slice = setTimeout(() => resolve3("pending"), sliceMs))],
      new Promise((resolve3) => {
        if (signal.aborted) resolve3("gone");
        else signal.addEventListener("abort", onAbort = () => resolve3("gone"));
      })
    ]);
    if (first === "pending") return null;
    if (first === "gone" || signal.aborted) {
      run2.stop.abort();
      endRun(run2);
      throw hostError(msg("error.cancelled"), "cancelled");
    }
    endRun(run2);
    if (!first.ok) throw first.error;
    const { result } = first;
    const model = result.attempts.find((attempt) => attempt.ok)?.model ?? result.profile.model;
    void notifyDone(host, result.settings, model, Date.now() - run2.started);
    await addHistory(host, result.settings, {
      original: run2.input.prompt.trim(),
      enhanced: result.enhanced,
      style: result.style,
      model,
      source: "panel",
      ...result.project ? { project: result.project } : {}
    }).catch((error) => host.log(`history: ${error.message}`));
    return {
      enhanced: result.enhanced,
      model,
      profileName: result.profile.name,
      ms: Date.now() - run2.started,
      attempts: result.attempts,
      context: view(result.items),
      notes: result.notes
    };
  } finally {
    if (slice) clearTimeout(slice);
    if (onAbort) signal.removeEventListener("abort", onAbort);
    run2.waiting -= 1;
    if (run2.waiting === 0 && liveRuns.get(run2.key) === run2) {
      run2.orphan = setTimeout(() => {
        run2.stop.abort();
        endRun(run2);
      }, RUN_LIMITS.orphanMs);
    }
  }
}
async function enhanceRequest(host, input, signal, panelId) {
  const id2 = typeof input.runId === "string" ? input.runId.slice(0, 64) : "";
  const keepsWaiting = id2 !== "" && (input.resumable === true || input.resume === true);
  let run2;
  if (input.resume === true) {
    run2 = liveRuns.get(JSON.stringify([panelId, id2]));
    if (!run2 || run2.panelId !== panelId) throw hostError(msg("error.run_gone"), "unavailable");
  } else {
    run2 = startRun(host, input, panelId, keepsWaiting ? RUN_LIMITS.totalMs : RUN_LIMITS.budgetMs);
  }
  const answer = await waitForRun(host, run2, signal, keepsWaiting ? RUN_LIMITS.sliceMs : null);
  return answer ?? { pending: true, enhanced: "", model: "", profileName: "", ms: Date.now() - run2.started, attempts: [], context: [], notes: [] };
}
function registerRunHandlers(host) {
  host.panels.handle("prompt.enhance", async (input, { signal, panel }) => enhanceRequest(host, input, signal, panel.id));
  host.panels.handle("enhance.progress.get", async ({ runId }) => progressOf(runId));
  host.panels.handle("context.preview", async ({ prompt, terminalId, level, exclude, workspaceId }, { signal }) => {
    const settings = await readSettings(host);
    const requested = isContextLevel(level) ? level : settings.contextLevel;
    const allowed = allowedLevel(requested, settings);
    const gathered = await gatherContext(host, {
      level: allowed,
      prompt,
      terminalId: terminalId ?? null,
      terminalLines: settings.terminalLines,
      exclude: new Set(exclude ?? []),
      extraFiles: settings.extraContextFiles,
      excludePatterns: settings.excludePatterns,
      ...gatherPrivacy(settings),
      signal,
      workspaceId: workspaceId ?? null
    });
    const notes = [...gathered.notes];
    if (allowed !== requested) notes.push(PROJECT_FILES_OFF);
    if (allowed === "max") notes.push(msg("note.preview_no_picker"));
    return { context: view(gathered.items), notes, chars: gathered.items.reduce((sum, entry) => sum + entry.chars, 0) };
  });
  host.panels.handle("prompt.send", async ({ terminalId, text, enter, force }) => {
    const settings = await readSettings(host);
    if (!settings.privacy.allowTerminalSend) throw hostError(msg("error.send_off"), "not_permitted");
    if (host.host.has("session.send")) {
      const prompt = terminalSafe(text).trim();
      if (!prompt) throw hostError(msg("error.nothing_to_send"), "invalid_params");
      return host.host.call("session.send", { sessionId: terminalId, text: prompt });
    }
    const pieces = terminalChunks(text, settings.sendMode);
    if (pieces.length === 0) throw hostError(msg("error.nothing_to_send"), "invalid_params");
    const blocked = await blockedAgent(host, terminalId);
    if (blocked && force !== true) throw hostError(msg("error.agent_blocked", { name: blocked }), "conflict");
    const pressEnter = force !== true && !blocked && (enter ?? settings.sendPressEnter);
    const result = await sendPieces(host, terminalId, pieces);
    if (pressEnter && result.accepted) {
      await new Promise((resolve3) => setTimeout(resolve3, 150));
      await host.host.call("terminal.sendText", { terminalId, text: "\r" });
    }
    return { accepted: result.accepted };
  });
  host.panels.handle("prompt.copy", async ({ text }) => copyToClipboard(text));
  void cleanAttachments();
  host.panels.handle("attachments.put", async (input) => {
    if (input.index === 0) void cleanAttachments();
    try {
      return await putChunk(input);
    } catch (error) {
      if (error instanceof LlmError) throw hostError(error.text, error.code);
      throw error;
    }
  });
  host.panels.handle("targets.list", async (input) => {
    const targets = [];
    const seen = /* @__PURE__ */ new Set();
    const agents = await host.host.call("agents.list", {}).catch(() => null);
    for (const agent of agents?.agents ?? []) {
      if (agent.terminalId && !seen.has(agent.terminalId)) {
        seen.add(agent.terminalId);
        const title = agent.title ?? agent.agent ?? "Agent";
        targets.push({ terminalId: agent.terminalId, label: `${title} \xB7 ${agent.state}`, agent: agent.agent, title, state: agent.state });
      }
    }
    const context = await host.host.call("workspace.readContext", {}).catch(() => null);
    for (const terminal of context?.terminals ?? []) {
      if (!seen.has(terminal.id)) {
        seen.add(terminal.id);
        targets.push({ terminalId: terminal.id, label: terminal.title ?? terminal.id, agent: null });
      }
    }
    const raw2 = input ?? {};
    const known2 = raw2.known && typeof raw2.known === "object" ? raw2.known : {};
    const hints = [...new Set(targets.map((target) => known2[target.terminalId]).filter((id2) => typeof id2 === "string" && id2.length > 0))];
    const workspace = context ? await findFocusedWorkspace(host, context, hints) : null;
    const choices = context && !workspace ? await focusedCandidates(host, context) : [];
    return {
      targets,
      workspace: context?.displayName ?? null,
      // The name this project's rules are kept under; null while the host cannot tell which project it is.
      project: context ? await projectNameOf(host, context, workspace) : null,
      workspaceId: workspace?.id ?? null,
      // Its folder, so the panel can tell which project the host removed (that event names it another way).
      ...workspace ? { workspacePath: workspace.path } : {},
      ...choices.length > 0 ? { choices } : {}
    };
  });
}
function registerModelHandlers(host) {
  const catalogsInFlight = /* @__PURE__ */ new Map();
  host.panels.handle("models.get", async () => modelsView(host));
  host.panels.handle("models.save", async (input) => {
    const config = await editableModels(host);
    const existing = input.id ? config.profiles.findIndex((profile2) => profile2.id === input.id) : -1;
    const id2 = existing >= 0 ? config.profiles[existing].id : newProfileId(input.name || input.preset);
    const profile = normalizeProfile({ ...input, id: id2 });
    if (!profile) throw hostError(msg("error.invalid_profile"), "invalid_params");
    if (profile.provider === "copilot" && input.apiKey?.trim()) throw hostError(msg("error.invalid_profile"), "invalid_params");
    if (input.apiKey?.trim()) {
      try {
        await host.secrets.set(secretName(id2), input.apiKey.trim());
      } catch (error) {
        host.log(`models.save: the key was not stored: ${error.message}`);
        throw hostError(msg("error.key_not_saved"), "action_failed");
      }
    }
    if (existing >= 0) config.profiles[existing] = profile;
    else config.profiles.push(profile);
    await saveModels(host, config);
    if (input.apiKey !== void 0 && !input.apiKey.trim()) await host.secrets.delete(secretName(id2)).catch(() => void 0);
    return modelsView(host);
  });
  host.panels.handle("models.delete", async ({ id: id2 }) => {
    const config = await editableModels(host);
    config.profiles = config.profiles.filter((profile) => profile.id !== id2);
    if (config.hookProfileId === id2) config.hookProfileId = null;
    if (config.selectorProfileId === id2) config.selectorProfileId = null;
    await saveModels(host, config);
    await host.secrets.delete(secretName(id2)).catch(() => void 0);
    return modelsView(host);
  });
  host.panels.handle("models.move", async ({ id: id2, direction, to }) => {
    const config = await editableModels(host);
    const index = config.profiles.findIndex((profile) => profile.id === id2);
    const step = direction === "up" ? -1 : 1;
    const target = typeof to === "number" ? Math.round(to) : index + step;
    if (index >= 0 && target >= 0 && target < config.profiles.length) {
      const [moved] = config.profiles.splice(index, 1);
      config.profiles.splice(target, 0, moved);
      await saveModels(host, config);
    }
    return modelsView(host);
  });
  host.panels.handle("models.roles", async ({ hookProfileId, selectorProfileId }) => {
    const config = await editableModels(host);
    const valid = (id2) => id2 && config.profiles.some((profile) => profile.id === id2) ? id2 : null;
    const hook = valid(hookProfileId);
    config.hookProfileId = hook && ["openai", "anthropic"].includes(config.profiles.find((profile) => profile.id === hook)?.provider ?? "") ? hook : null;
    config.selectorProfileId = valid(selectorProfileId);
    await saveModels(host, config);
    return modelsView(host);
  });
  host.panels.handle("models.test", async ({ id: id2 }, { signal }) => {
    const config = await loadModels(host);
    const profile = config.profiles.find((entry) => entry.id === id2);
    if (!profile) return { ok: false, message: english(msg("error.unknown_profile")), text: msg("error.unknown_profile"), ms: 0 };
    const settings = await readSettings(host);
    const started = Date.now();
    try {
      const { attempts } = await runChain(
        host,
        [profile],
        "Reply with exactly: OK",
        "ping",
        chainOptions(settings, signal, { timeoutMs: 3e4, fallback: false })
      );
      const keySource = (await resolveKey(host, profile)).source;
      const text = msg("result.test_ok", { name: profile.name, model: attempts[0]?.model || "default", key: keySource });
      return { ok: true, message: english(text), text, ms: Date.now() - started };
    } catch (error) {
      const text = messageOf(error);
      return { ok: false, message: english(text), text, ms: Date.now() - started };
    }
  });
  host.panels.handle("models.catalog", async (input) => {
    const preset = presetById(input.preset);
    const config = await loadModels(host);
    const profile = input.profileId ? config.profiles.find((entry) => entry.id === input.profileId) : void 0;
    const provider = preset.id === "custom" ? (input.provider ?? profile?.provider) === "anthropic" ? "anthropic" : "openai" : preset.provider;
    if (provider === "copilot") {
      if (!(await readSettings(host)).privacy.allowOnlineModelLists) return { models: [], source: "GitHub Copilot", fetchedAt: Date.now(), error: english(msg("error.lists_off")), errorText: msg("error.lists_off") };
      try {
        return await host.host.call("copilot.catalog", {});
      } catch (error) {
        return { models: [], source: "GitHub Copilot", fetchedAt: Date.now(), error: english(messageOf(error)), errorText: messageOf(error) };
      }
    }
    const baseUrl = (input.baseUrl ?? profile?.baseUrl ?? "").trim() || preset.baseUrl;
    const command = (input.command ?? profile?.command ?? "").trim();
    const cliKey = `catalog:v3:${preset.id}`;
    let cacheKey = provider === "cli" ? cliKey : `catalog:v3:${provider}:${baseUrl}`;
    if (preset.id === "claude-code") cacheKey = `${cliKey}:${await claudeProgramSignature(command)}`;
    if (!input.refresh) {
      const cached = parseCatalog(await host.storage.get(cacheKey));
      if (cached && cached.models.length > 0 && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
        return cached;
      }
    }
    const flightKey = `${cacheKey}${input.apiKey?.trim() ? ":typed" : ""}`;
    const running = catalogsInFlight.get(flightKey);
    if (running) return running;
    const fetching = (async () => {
      const catalog = await fetchCatalog(host, { presetId: preset.id, env: preset.env, provider, baseUrl, command, profile, typedKey: input.apiKey?.trim() });
      if (catalog.models.length > 0) {
        await host.storage.set(cacheKey, { ...catalog, models: catalog.models.map((model) => ({ ...model })) });
        if (preset.id === "claude-code") {
          for (const key of await host.storage.keys()) {
            if ((key === cliKey || key.startsWith(`${cliKey}:`)) && key !== cacheKey) await host.storage.delete(key);
          }
        }
      }
      return catalog;
    })();
    catalogsInFlight.set(flightKey, fetching);
    try {
      return await fetching;
    } finally {
      catalogsInFlight.delete(flightKey);
    }
  });
  host.panels.handle("models.detect", async () => {
    const config = await loadModels(host);
    const found = detectClis().map(({ kind, path }) => ({
      preset: kind,
      label: presetById(kind).label,
      path,
      added: config.profiles.some(
        (profile) => profile.preset === kind && (!profile.command || profile.command === path || profile.command === CLI_BINARIES[kind])
      )
    }));
    return { found };
  });
}
function registerDataHandlers(host) {
  let rulesQueue = Promise.resolve();
  host.panels.handle("rules.get", async () => parseRulesConfig(await host.storage.get(RULES_KEY)));
  host.panels.handle("rules.save", async ({ config }) => {
    const clean = parseRulesConfig(rulesToJson(config));
    const write = rulesQueue.then(() => host.storage.set(RULES_KEY, rulesToJson(clean)));
    rulesQueue = write.catch(() => void 0);
    await write;
    return clean;
  });
  host.panels.handle("history.remove", async ({ id: id2 }) => {
    await historyChange(host, async () => {
      const list = parseHistory(await host.storage.get(HISTORY_KEY));
      const gone = list.find((entry) => entry.id === id2);
      if (!gone) return;
      await host.storage.set(HISTORY_KEY, list.filter((entry) => entry.id !== id2).map(toJson));
      removedEntries.set(id2, { entry: gone, until: Date.now() + UNDO_MS });
      for (const [key, kept] of removedEntries) if (kept.until < Date.now() || removedEntries.size > UNDO_KEPT) removedEntries.delete(key);
    });
    return { ok: true };
  });
  host.panels.handle("history.restore", async ({ id: id2 }) => {
    const kept = removedEntries.get(typeof id2 === "string" ? id2 : "");
    removedEntries.delete(typeof id2 === "string" ? id2 : "");
    const settings = await readSettings(host);
    if (!kept || kept.until < Date.now() || settings.historyLimit <= 0 || !settings.privacy.saveHistory) return { restored: false };
    let restored = false;
    await historyChange(host, async () => {
      const list = parseHistory(await host.storage.get(HISTORY_KEY));
      if (list.some((entry) => entry.id === kept.entry.id)) {
        restored = true;
        return;
      }
      const next = capHistory([...list, kept.entry].sort((a, b) => b.at - a.at), settings.historyLimit);
      restored = next.some((entry) => entry.id === kept.entry.id);
      if (restored) await host.storage.set(HISTORY_KEY, next.map(toJson));
    });
    return { restored };
  });
  host.panels.handle("history.clear", async () => {
    removedEntries.clear();
    await historyChange(host, () => host.storage.delete(HISTORY_KEY));
    return { ok: true };
  });
  host.panels.handle("data.summary", async () => {
    const keys = await host.storage.keys();
    const config = await loadModels(host);
    const history = parseHistory(await host.storage.get(HISTORY_KEY));
    let secretsStored = 0;
    for (const profile of config.profiles) if (await host.secrets.get(secretName(profile.id)).catch(() => null)) secretsStored++;
    return {
      history: history.length,
      profiles: config.fromEnv ? 0 : config.profiles.length,
      keys: secretsStored,
      catalogs: keys.filter((key) => key.startsWith("catalog:")).length
    };
  });
  host.panels.handle("data.clear", async ({ what }) => {
    const keys = await host.storage.keys();
    if (what === "history" || what === "all") {
      removedEntries.clear();
      await historyChange(host, () => host.storage.delete(HISTORY_KEY));
    }
    if (what === "catalogs" || what === "all") {
      for (const key of keys.filter((entry) => entry.startsWith("catalog:"))) await host.storage.delete(key);
    }
    if (what === "all") {
      const config = await loadModels(host);
      for (const profile of config.profiles) await host.secrets.delete(secretName(profile.id)).catch(() => void 0);
      await host.storage.delete(MODELS_KEY);
      await host.storage.delete(RULES_KEY);
      await host.storage.delete(CONSENTS_KEY);
      await host.storage.delete(LOCALE_KEY);
      await host.storage.delete("colorTheme");
      forgetActivity();
      launchedPrompts.clear();
      lastHook = null;
      await forgetTerminals(host);
      await clearAttachments().catch((error) => host.log(`attachments: ${error.message}`));
    }
    return { ok: true };
  });
}
var LAUNCH_MEMORY_MS = 12e4;
var launchedPrompts = /* @__PURE__ */ new Map();
function wasLaunchedHere(prompt) {
  const now = Date.now();
  for (const [text, until] of launchedPrompts) if (until < now) launchedPrompts.delete(text);
  return launchedPrompts.has(terminalSafe(prompt).trim());
}
var warming = /* @__PURE__ */ new Set();
var lastHook = null;
function noteHook(host, record) {
  lastHook = { at: Date.now(), ...record };
  if (record.outcome === "skipped" && record.reason) host.panels.post("hook.skipped", { agent: record.agent, reason: record.reason });
}
function registerAutoEnhance(host) {
  host.panels.handle("hook.last", async () => lastHook ?? await host.storage.get("panel:hookLast"));
  host.hooks.on("agent.prompt.before", async (event, next) => {
    const started = Date.now();
    const settings = await readSettings(host);
    const prompt = event.prompt;
    if (settings.autoEnhanceMode === "off" || prompt.trim().length < settings.autoEnhanceMinLength) return;
    if (wasLaunchedHere(prompt)) return;
    if (settings.autoEnhanceMode === "rules") {
      const append = settings.autoEnhanceAppend.trim();
      if (!append || prompt.includes(append)) return;
      host.panels.post("hook.enhanced", { agent: event.agent, mode: "rules" });
      noteHook(host, { outcome: "appended", agent: event.agent });
      return next({ ...event, prompt: `${prompt.trimEnd()}

${append}` });
    }
    try {
      const config = await loadModels(host);
      const place = await hookPlace(host, event.terminalId);
      const items = settings.autoEnhanceContext ? hookContext(place, settings.privacy.allowProjectFiles) : [];
      if (settings.autoEnhanceContext && settings.privacy.allowProjectFiles && place?.workspace && isLocalWorkspace(place.workspace) && !cachedStatic(place.workspace.path)) {
        const root = place.workspace.path;
        if (!warming.has(root)) {
          warming.add(root);
          void staticParts(root, settings.extraContextFiles, true, settings.privacy.allowGit).catch(() => void 0).finally(() => warming.delete(root));
        }
      }
      const rules = rulesFor(parseRulesConfig(await host.storage.get(RULES_KEY).catch(() => null)), place?.where ?? { workspace: null, project: null });
      const system = buildSystemPrompt({
        style: settings.defaultStyle,
        language: settings.outputLanguage,
        customInstructions: settings.customInstructions,
        agent: settings.adaptToAgent ? event.agent : null,
        rules
      });
      const apiProfiles = config.profiles.filter((profile) => profile.enabled && ["openai", "anthropic"].includes(profile.provider));
      const hookProfileId = apiProfiles.some((profile) => profile.id === config.hookProfileId) ? config.hookProfileId : null;
      const list = candidates(apiProfiles, hookProfileId, settings.fallbackEnabled);
      if (list.length === 0) {
        host.log("auto-enhance skipped: no enabled API model (subscription CLIs are too slow for the hook)");
        noteHook(host, { outcome: "skipped", agent: event.agent, reason: msg("hook.no_model") });
        return;
      }
      const result = await runChain(
        host,
        list,
        system,
        buildUserMessage(prompt, items),
        chainOptions(settings, void 0, { totalMs: HOOK_BUDGET_MS - (Date.now() - started) })
      );
      const enhanced = terminalSafe(cleanOutput(result.text)).trim();
      if (!enhanced) {
        host.log("auto-enhance skipped: the model returned no prompt");
        noteHook(host, { outcome: "skipped", agent: event.agent, reason: msg("hook.empty") });
        return;
      }
      const model = result.attempts.find((attempt) => attempt.ok)?.model ?? result.profile.model;
      void addHistory(host, settings, {
        original: prompt,
        enhanced,
        style: settings.defaultStyle,
        model,
        source: "hook",
        ...place?.where.project ? { project: place.where.project } : {}
      }).catch(() => void 0);
      host.panels.post("hook.enhanced", { agent: event.agent, mode: "ai", model });
      noteHook(host, { outcome: "rewritten", agent: event.agent, model });
      return next({ ...event, prompt: enhanced });
    } catch (error) {
      host.log(`auto-enhance skipped: ${error.message}`);
      const reason = error instanceof ChainError || error instanceof LlmError ? error.text : raw(error.message);
      noteHook(host, { outcome: "skipped", agent: event.agent, reason });
      return;
    }
  });
  let warmTimer = null;
  host.events.on("workspace.changed", ({ context }) => {
    if (!context) return;
    if (warmTimer) clearTimeout(warmTimer);
    warmTimer = setTimeout(async () => {
      try {
        const settings = await readSettings(host);
        const wantsHook = settings.autoEnhanceMode === "ai" && settings.autoEnhanceContext;
        if (!wantsHook && !atLeast(settings.contextLevel, "standard")) return;
        const workspace = await findFocusedWorkspace(host, context);
        if (workspace && isLocalWorkspace(workspace) && settings.privacy.allowProjectFiles) {
          await staticParts(workspace.path, settings.extraContextFiles, true, settings.privacy.allowGit);
        }
      } catch (error) {
        host.log(`context warm-up: ${error.message}`);
      }
    }, 1500);
  });
}
function registerCommands(host) {
  host.commands.register("auto-enhance.cycle", async () => {
    const { autoEnhanceMode } = await readSettings(host);
    const next = AUTO_MODES[(AUTO_MODES.indexOf(autoEnhanceMode) + 1) % AUTO_MODES.length];
    await host.settings.set("autoEnhanceMode", next);
    await refreshStatusBar(host);
    return modeAnswer(host, next);
  });
  host.commands.register("auto-enhance.off", async () => setMode(host, "off"));
  host.commands.register("auto-enhance.rules", async () => setMode(host, "rules"));
  host.commands.register("auto-enhance.ai", async () => setMode(host, "ai"));
  host.commands.register("status-bar.toggle", async () => {
    const all = await host.settings.get();
    const next = all.statusBarItem === "hidden" ? "full" : "hidden";
    await host.settings.set("statusBarItem", next);
    await refreshStatusBar(host);
    return (await workerWords(host)).bar[next === "hidden" ? "hidden" : "shown"];
  });
  host.settings.onDidChange(({ key }) => {
    if (key === "autoEnhanceMode" || key === "statusBarItem" || key === "uiLanguage") void refreshStatusBar(host);
  });
  host.panels.handle("ui.locale", async ({ locale }) => {
    const value = typeof locale === "string" ? locale.trim().slice(0, 35) : "";
    if (value && await host.storage.get(LOCALE_KEY).catch(() => null) !== value) {
      await host.storage.set(LOCALE_KEY, value);
      await refreshStatusBar(host);
    }
    return { ok: true };
  });
  void refreshStatusBar(host);
}
var live = parsePrivacy({}, {});
async function refreshLive(host) {
  const before = live;
  live = (await readSettings(host).catch(() => null))?.privacy ?? live;
  if (before.allowAgentActivity && !live.allowAgentActivity) forgetActivity("agents");
  if (before.allowEditorSaves && !live.allowEditorSaves) forgetActivity("saves");
}
function workspacePath(path) {
  if (typeof path !== "string") return null;
  const clean = path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean || clean.length > 500 || clean.startsWith("/") || /^[a-zA-Z]:/.test(clean) || clean.split("/").includes("..") || isSensitive(clean)) return null;
  return clean;
}
async function focusedWorkspaceId(host, hint) {
  const focused = await host.host.call("workspace.readContext", {}).catch(() => null);
  if (!focused) return null;
  return (await findFocusedWorkspace(host, focused, typeof hint === "string" ? hint : null))?.id ?? null;
}
var AGENT_KIND = /^[a-z][a-z0-9_-]{0,31}$/;
function registerIntegrations(host) {
  void refreshLive(host);
  host.settings.onDidChange(() => void refreshLive(host));
  host.storage.onDidChange(({ key }) => {
    if (key === CONSENTS_KEY) void refreshLive(host);
  });
  void loadTerminals(host);
  host.hooks.on("agent.tool.after", (event) => {
    learnTerminal(host, event.terminalId, event.workspaceId);
    if (live.allowAgentActivity) recordTool(event);
  });
  host.events.on("agent.status.changed", (event) => {
    learnTerminal(host, event.terminalId, event.workspaceId);
    if (live.allowAgentActivity) recordStatus(event);
  });
  host.hooks.on("editor.save.before", (event) => {
    if (live.allowEditorSaves) recordSave(event);
  });
  host.panels.handle("consents.get", async () => {
    const consents = parseConsents(await host.storage.get(CONSENTS_KEY).catch(() => null));
    return { granted: [...NEEDS_CONSENT].filter((key) => consents[key] === true), needed: [...NEEDS_CONSENT] };
  });
  host.panels.handle("consent.set", async ({ key, granted }) => {
    if (!NEEDS_CONSENT.has(key)) throw hostError(msg("error.invalid_request"), "invalid_params");
    const consents = parseConsents(await host.storage.get(CONSENTS_KEY).catch(() => null));
    if (granted) consents[key] = true;
    else delete consents[key];
    await host.storage.set(CONSENTS_KEY, consents);
    await refreshLive(host);
    return { granted: [...NEEDS_CONSENT].filter((entry) => consents[entry] === true) };
  });
  host.panels.handle("agent.launch", async ({ agent, prompt, workspaceId }) => {
    const settings = await readSettings(host);
    if (!settings.privacy.allowAgentLaunch) throw hostError(msg("error.launch_off"), "not_permitted");
    if (!host.host.has("agent.launch")) throw hostError(msg("error.unsupported"), "unavailable");
    if (typeof agent !== "string" || !AGENT_KIND.test(agent)) throw hostError(msg("error.invalid_request"), "invalid_params");
    const text = terminalSafe(String(prompt ?? "")).trim().slice(0, 2e4);
    if (!text) throw hostError(msg("error.nothing_to_send"), "invalid_params");
    const id2 = await focusedWorkspaceId(host, workspaceId);
    if (!id2) throw hostError(msg("note.no_workspace"), "invalid_params");
    launchedPrompts.set(text, Date.now() + LAUNCH_MEMORY_MS);
    const started = await host.host.call("agent.launch", { workspaceId: id2, agent, prompt: text });
    learnTerminal(host, started.terminalId, id2);
    return started;
  });
  host.panels.handle("editor.open", async ({ path, workspaceId }) => {
    const settings = await readSettings(host);
    if (!settings.privacy.allowOpenFiles) throw hostError(msg("error.open_off"), "not_permitted");
    if (!host.host.has("editor.open")) throw hostError(msg("error.unsupported"), "unavailable");
    const clean = workspacePath(path);
    if (!clean) throw hostError(msg("error.invalid_request"), "invalid_params");
    const id2 = await focusedWorkspaceId(host, workspaceId);
    if (!id2) throw hostError(msg("note.no_workspace"), "invalid_params");
    return host.host.call("editor.open", { workspaceId: id2, path: clean });
  });
}
async function notifyDone(host, settings, model, ms) {
  if (!settings.notifyWhenDone || ms < NOTIFY_AFTER_MS || !host.host.has("notifications.show")) return;
  const lang = await workerLanguage(host, settings.uiLanguage);
  const body = translate(lang, "Enhanced prompt ready ({model}, {seconds} s)", { model, seconds: (ms / 1e3).toFixed(0) });
  await host.host.call("notifications.show", { title: BRAND, body }).catch(() => void 0);
}
var NOTIFY_AFTER_MS = 8e3;
function activate(host) {
  registerIntegrations(host);
  registerRunHandlers(host);
  registerModelHandlers(host);
  registerDataHandlers(host);
  registerAutoEnhance(host);
  registerCommands(host);
}

// src/worker-host.ts
import { EventEmitter } from "node:events";

// src/version.ts
var VERSION = "0.2.3";

// src/diagnostics.ts
var OPERATIONS = /* @__PURE__ */ new Set([
  "worker.ready",
  "canvas.connection",
  "canvas.request",
  "panel.start",
  "panel.persistence",
  "clipboard",
  "prompt.enhance",
  "prompt.send",
  "prompt.copy",
  "context.preview",
  "attachments.put",
  "models.get",
  "models.save",
  "models.delete",
  "models.move",
  "models.roles",
  "models.test",
  "models.catalog",
  "models.detect",
  "history.remove",
  "history.clear",
  "history.restore",
  "consents.get",
  "consent.set",
  "agent.launch",
  "editor.open",
  "targets.list",
  "ui.locale",
  "hook.last",
  "rules.get",
  "rules.save",
  "data.summary",
  "data.clear",
  "copilot.refresh",
  "copilot.catalog",
  "copilot.runtime",
  "copilot.start",
  "copilot.session",
  "copilot.access",
  "copilot.workspace",
  "copilot.tools",
  "copilot.images",
  "copilot.account",
  "copilot.generate",
  "copilot.cleanup"
]);
var CODES = /* @__PURE__ */ new Set([
  "aborted",
  "cancelled",
  "timeout",
  "unavailable",
  "invalid_params",
  "action_failed",
  "rate_limited",
  "disconnected",
  "request_failed",
  "unauthorized",
  "forbidden",
  "network",
  "AbortError",
  "TimeoutError",
  "NotAllowedError",
  "ERR_MODULE_NOT_FOUND",
  "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "ERR_REQUIRE_ESM",
  "ENOENT",
  "EACCES",
  "EPERM",
  ...Object.keys(MESSAGES).filter((code) => code.startsWith("error."))
]);
var DISCOVERY_STAGES = ["runtime_identity", "runtime_path", "sdk_import", "sdk_api", "session_api", "model_list", "filter", "complete", "privacy"];
var DISCOVERY_CHECKS = ["executableAllowed", "bootstrapPresent", "bootstrapEmbedded", "sdkPathPresent", "parentMatches", "extensionSandboxed", "runtimePathResolved", "sdkImported", "clientAvailable", "stdioAvailable", "modelListAvailable", "responseIsList"];
var DISCOVERY_COUNTS = ["received", "eligible", "invalid", "otherProvider", "unattributed", "policyBlocked"];
function diagnosticError(error) {
  const value = error;
  const message = value?.text ?? (typeof value?.message === "string" ? messageIn(value.message) : void 0);
  const code = [message?.code, value?.code, value?.name].find((code2) => typeof code2 === "string" && CODES.has(code2)) ?? "request_failed";
  const status = value?.status ?? (message?.code === "error.http" ? message.params?.status : void 0);
  return { code, ...typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {} };
}
function createDiagnostics() {
  const entries = [];
  let discovery = null;
  let attempts = 0;
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const limit = 200;
  return {
    beginModelDiscovery() {
      const current = { attempt: ++attempts, startedAt: (/* @__PURE__ */ new Date()).toISOString(), stage: "runtime_identity", outcome: "running", checks: {}, counts: {} };
      discovery = current;
      return {
        stage(value) {
          if (current.outcome === "running" && DISCOVERY_STAGES.includes(value)) current.stage = value;
        },
        check(key, value) {
          if (current.outcome === "running" && DISCOVERY_CHECKS.includes(key) && typeof value === "boolean") current.checks[key] = value;
        },
        count(key, value) {
          if (current.outcome === "running" && DISCOVERY_COUNTS.includes(key) && Number.isSafeInteger(value) && value >= 0) current.counts[key] = value;
        },
        finish(outcome, error) {
          if (current.outcome !== "running" || !["ok", "empty", "failed"].includes(outcome)) return;
          current.outcome = outcome;
          current.completedAt = (/* @__PURE__ */ new Date()).toISOString();
          if (error) {
            const code = error.code;
            current.failure = { ...diagnosticError(error), ...[-32700, -32600, -32601, -32602, -32603, -32e3].includes(code) ? { rpcCode: code } : {} };
          }
        }
      };
    },
    record(operation, outcome, details = {}) {
      if (!OPERATIONS.has(operation) || !["started", "ok", "failed", "cancelled", "pending"].includes(outcome)) return;
      const { ms, code, status } = details;
      entries.push({
        at: (/* @__PURE__ */ new Date()).toISOString(),
        operation,
        outcome,
        ...typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? { ms: Math.round(ms) } : {},
        ...typeof code === "string" && CODES.has(code) ? { code } : {},
        ...typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}
      });
      if (entries.length > limit) entries.splice(0, entries.length - limit);
    },
    snapshot() {
      return { version: VERSION, capturedAt: (/* @__PURE__ */ new Date()).toISOString(), startedAt, limit, entries: entries.map((entry) => ({ ...entry })), copilotModelDiscovery: discovery ? structuredClone(discovery) : null };
    }
  };
}

// src/worker-host.ts
function createWorkerHost(services, log = (_message) => {
}, diagnostics = createDiagnostics()) {
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const handlers = /* @__PURE__ */ new Map();
  handlers.set("logs.get", () => ({ ...diagnostics.snapshot(), platform: process.platform, architecture: process.arch, runtime: process.version }));
  diagnostics.record("worker.ready", "ok");
  const hooks = /* @__PURE__ */ new Map();
  const commands = /* @__PURE__ */ new Map();
  const requests = /* @__PURE__ */ new Map();
  const listen = (name, handler) => {
    events.on(name, handler);
    return { dispose: () => {
      events.off(name, handler);
    } };
  };
  const api = {
    ...services,
    log,
    panels: {
      handle: (name, handler) => {
        handlers.set(name, handler);
        return { dispose: () => {
          handlers.delete(name);
        } };
      },
      post: (name, payload, options) => {
        events.emit("post", { event: name, payload, panel: options?.panel });
      }
    },
    events: { on: (name, handler) => listen(name, handler) },
    hooks: { on: (name, handler) => {
      const list = hooks.get(name) ?? [];
      list.push(handler);
      hooks.set(name, list);
      return { dispose: () => {
        const index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
      } };
    } },
    commands: { register: (name, handler) => {
      commands.set(name, handler);
      return { dispose: () => {
        commands.delete(name);
      } };
    } }
  };
  async function request(name, input, options = {}) {
    const handler = handlers.get(name);
    if (!handler) throw Object.assign(new Error(`Unknown request: ${name}`), { code: "unavailable" });
    const controller = new AbortController();
    const panelId = options.panelId ?? options.panel ?? "panel";
    requests.set(controller, panelId);
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = options.timeoutMs ? setTimeout(abort, options.timeoutMs) : void 0;
    let onAbort = () => {
    };
    const started = Date.now();
    const quiet = ["logs.get", "targets.list", "hook.last", "data.summary", "consents.get", "ui.locale", "enhance.progress.get"].includes(name);
    if (!quiet) diagnostics.record(name, "started");
    try {
      const stopped = new Promise((_resolve, reject) => {
        onAbort = () => reject(Object.assign(new Error("The request was aborted."), { code: "aborted" }));
        if (controller.signal.aborted) onAbort();
        else controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const answer = await Promise.race([Promise.resolve().then(() => handler(input ?? {}, { signal: controller.signal, panel: { id: panelId } })), stopped]);
      const result = answer;
      const failed = result?.ok === false || result?.copied === false || result?.accepted === false || result?.restored === false || !!result?.error;
      if (name === "models.catalog" && input?.preset === "copilot" && diagnosticError({ text: result?.errorText }).code === "error.lists_off") {
        const probe = diagnostics.beginModelDiscovery();
        probe.stage("privacy");
        probe.finish("failed", { text: result?.errorText });
      }
      if (!quiet || failed) diagnostics.record(name, failed ? "failed" : result?.pending ? "pending" : "ok", {
        ms: Date.now() - started,
        ...failed ? diagnosticError({ text: result?.errorText ?? result?.text }) : {}
      });
      return answer;
    } catch (error) {
      diagnostics.record(name, controller.signal.aborted ? "cancelled" : "failed", { ms: Date.now() - started, ...diagnosticError(error) });
      throw error;
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      options.signal?.removeEventListener("abort", abort);
      requests.delete(controller);
    }
  }
  async function fire(name, event) {
    let current = event;
    for (const handler of hooks.get(name) ?? []) await handler(current, (updated) => {
      current = updated;
    });
    return { kind: "continue", event: current };
  }
  function panel(panelId) {
    return {
      settings: services.settings,
      storage: services.storage,
      plugin: {
        request: (name, input, options) => request(name, input, { ...options, panelId }),
        on: (name, handler) => listen("post", (post) => {
          if (post.event === name && (!post.panel || post.panel === panelId)) handler(post.payload);
        })
      },
      on: (name, handler) => listen(name, handler)
    };
  }
  return {
    api,
    request,
    hooks: { fire },
    panel,
    emit(name, payload) {
      events.emit(name, payload);
    },
    onPost: (handler) => listen("post", handler),
    async command(name) {
      const handler = commands.get(name);
      if (!handler) throw new Error(`Unknown command: ${name}`);
      return await handler();
    },
    closePanel(panelId) {
      for (const [request2, owner] of requests) if (owner === panelId) request2.abort();
    },
    async deactivate() {
      for (const request2 of requests.keys()) request2.abort();
      requests.clear();
      events.removeAllListeners();
      hooks.clear();
      commands.clear();
      handlers.clear();
    }
  };
}

// src/copilot/services.ts
import { homedir as homedir3 } from "node:os";
import { join as join6 } from "node:path";
import { createHash as createHash2 } from "node:crypto";

// src/defaults.ts
var DEFAULTS = {
  "uiLanguage": "auto",
  "statusBarItem": "full",
  "defaultStyle": "balanced",
  "outputLanguage": "auto",
  "customInstructions": "",
  "contextLevel": "standard",
  "terminalLines": 100,
  "extraContextFiles": "",
  "excludePatterns": "dist/\nbuild/\nout/\ncoverage/\n*.lock\npackage-lock.json\npnpm-lock.yaml\n*.min.js\n*.map\n*.snap",
  "adaptToAgent": true,
  "fallbackEnabled": true,
  "fallbackOn": "any",
  "timeoutSeconds": 60,
  "sendMode": "paste",
  "sendPressEnter": false,
  "historyLimit": 50,
  "notifyWhenDone": false,
  "autoEnhanceMode": "off",
  "autoEnhanceAppend": "Before you finish: keep changes minimal and focused, follow the existing code style, run the relevant tests or type checks, and summarize what you changed.",
  "autoEnhanceMinLength": 8,
  "autoEnhanceContext": true,
  "allowProjectFiles": true,
  "allowGit": true,
  "allowTerminalRead": true,
  "allowOtherAgents": false,
  "otherAgentsMax": 4,
  "otherAgentsLines": 80,
  "allowAgentActivity": false,
  "allowEditorSaves": false,
  "allowTerminalSend": true,
  "allowAgentLaunch": false,
  "allowOpenFiles": true,
  "saveHistory": true,
  "allowEnvKeys": true,
  "allowOnlineModelLists": true
};

// src/copilot/storage.ts
var import_proper_lockfile = __toESM(require_proper_lockfile(), 1);
import { AsyncLocalStorage } from "node:async_hooks";
import { EventEmitter as EventEmitter2 } from "node:events";
import { mkdir as mkdir2, readFile as readFile5, rename, writeFile } from "node:fs/promises";
import { watchFile, unwatchFile } from "node:fs";
import { join as join5, resolve as resolve2 } from "node:path";
import { randomUUID } from "node:crypto";
var held = new AsyncLocalStorage();
var buses = /* @__PURE__ */ new Map();
function persistentStore(directory) {
  const root = resolve2(directory);
  const file = join5(root, "state.json");
  const bus = buses.get(root) ?? new EventEmitter2();
  bus.setMaxListeners(100);
  buses.set(root, bus);
  const read = async () => {
    try {
      const value = JSON.parse(await readFile5(file, "utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Enhance Prompt storage.");
      return value;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  };
  const transaction = async (fn) => {
    if (held.getStore()?.has(root)) return fn();
    await mkdir2(root, { recursive: true, mode: 448 });
    const release = await import_proper_lockfile.default.lock(root, { realpath: false, stale: 3e4, retries: { retries: 80, minTimeout: 20, maxTimeout: 250, factor: 1.2 } });
    try {
      return await held.run(/* @__PURE__ */ new Set([...held.getStore() ?? [], root]), fn);
    } finally {
      await release();
    }
  };
  const change = async (key, value) => transaction(async () => {
    if (["__proto__", "constructor", "prototype"].includes(key) || key.length > 2e3) throw new Error("Invalid storage key.");
    const data = await read();
    if (value === void 0) delete data[key];
    else data[key] = value;
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data), { encoding: "utf8", mode: 384 });
    await rename(temporary, file);
    bus.emit("change", { key });
  });
  return {
    get: async (key) => {
      const data = await read();
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    set: (key, value) => change(key, value),
    delete: (key) => change(key),
    keys: async () => Object.keys(await read()),
    onDidChange: (listener) => {
      bus.on("change", listener);
      let active = true;
      let previous = read().catch(() => ({}));
      const refresh = () => {
        const next = read().catch(() => ({}));
        void Promise.all([previous, next]).then(([before, after]) => {
          if (!active) return;
          for (const key of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) listener({ key });
          }
        }).catch(() => {
        });
        previous = next;
      };
      watchFile(file, { interval: 500, persistent: false }, refresh);
      return { dispose: () => {
        active = false;
        bus.off("change", listener);
        unwatchFile(file, refresh);
      } };
    },
    transaction
  };
}

// src/copilot/secrets.ts
import { spawn as spawn3 } from "node:child_process";
var SCRIPT = `Add-Type -AssemblyName System.Security
$r = [Console]::In.ReadToEnd() | ConvertFrom-Json
$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
if ($r.action -eq 'protect') {
  $bytes = [Text.Encoding]::UTF8.GetBytes($r.value)
  $out = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, $scope)
  [Console]::Out.Write([Convert]::ToBase64String($out))
} else {
  $bytes = [Convert]::FromBase64String($r.value)
  $out = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, $scope)
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($out))
}`;
function protectedSecrets(store) {
  const available = process.platform === "win32";
  async function crypt(action, value) {
    if (!available) throw new Error("OS-protected key storage is unavailable on this platform.");
    if (value.length > 16384) throw new Error("API key is too long.");
    return new Promise((resolve3, reject) => {
      const child = spawn3("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", SCRIPT], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
      let output = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("The protected key store timed out."));
      }, 1e4);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.length > 65536) child.kill();
      });
      child.on("error", () => {
        clearTimeout(timer);
        reject(new Error("The protected key store is unavailable."));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 || !output) reject(new Error("The protected key store could not read or write this key."));
        else resolve3(output);
      });
      child.stdin.on("error", () => {
      });
      child.stdin.end(JSON.stringify({ action, value }));
    });
  }
  return {
    available,
    get: async (key) => {
      const value = await store.get(key);
      return typeof value === "string" ? crypt("unprotect", value) : null;
    },
    set: async (key, value) => {
      const encrypted = await crypt("protect", value);
      await store.set(key, encrypted);
    },
    delete: (key) => store.delete(key)
  };
}

// src/copilot/session.ts
import { basename as basename2, isAbsolute as isAbsolute3 } from "node:path";
import { realpath as realpath2 } from "node:fs/promises";
var unavailable = (message) => Object.assign(new Error(message), { code: "unavailable" });
async function bounded(request) {
  let timer;
  try {
    return await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(unavailable("Copilot did not respond.")), 3e3);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
function sessionAdapter(session) {
  const sent = /* @__PURE__ */ new Map();
  let sending = false;
  let lastSent = 0;
  const markSent = (text) => {
    sent.set(text, Date.now() + 12e4);
  };
  const consumeSent = (text) => {
    for (const [key, until] of sent) if (until < Date.now()) sent.delete(key);
    const found = sent.has(text);
    sent.delete(text);
    return found;
  };
  const project = async () => {
    const info = await bounded(session.rpc.metadata.snapshot());
    if (info.isRemote || !isAbsolute3(info.workingDirectory)) return null;
    const path = await realpath2(info.workingDirectory);
    return { id: `copilot::${path}`, path, name: basename2(path) };
  };
  const state = async () => {
    try {
      const [activity, processing, permissions, queue] = await bounded(Promise.all([
        session.rpc.metadata.activity(),
        session.rpc.metadata.isProcessing(),
        session.rpc.permissions.pendingRequests(),
        session.rpc.queue.pendingItems()
      ]));
      if (!Array.isArray(permissions.items) || !Array.isArray(queue.items) || !Array.isArray(queue.steeringMessages) || typeof activity.hasActiveWork !== "boolean" || typeof processing.processing !== "boolean") return "unknown";
      if (permissions.items.length) return "blocked";
      if (activity.hasActiveWork || processing.processing || queue.items.length || queue.steeringMessages.length) return "working";
      return "waiting";
    } catch {
      return "unknown";
    }
  };
  const operations = /* @__PURE__ */ new Set(["workspace.list", "workspace.readContext", "agents.list", "session.send"]);
  return {
    has: (name) => operations.has(name),
    state,
    project,
    markSent,
    consumeSent,
    async call(name, input) {
      let result;
      if (name === "workspace.list") {
        const place = await project();
        result = { workspaces: place ? [{ ...place, project: place.path, branch: null, hostId: null }] : [] };
      } else if (name === "workspace.readContext") {
        const place = await project();
        result = { displayName: place?.name ?? "", branch: "", terminals: [{ id: session.sessionId, title: "GitHub Copilot" }], ...place ? { workspaceId: place.id } : {} };
      } else if (name === "agents.list") {
        const place = await project();
        result = { agents: [{ terminalId: session.sessionId, title: "GitHub Copilot", agent: "copilot", state: await state(), stateStartedAt: Date.now(), ...place ? { workspaceId: place.id } : {} }] };
      } else if (name === "session.send") {
        const { sessionId, text } = input;
        if (sessionId !== session.sessionId) throw unavailable("The canvas belongs to another Copilot session.");
        if (typeof text !== "string" || !text.trim() || text.length > 1e6) throw unavailable("The prompt is empty or too large.");
        if (sending || Date.now() - lastSent < 3e3) throw unavailable(withMessage(msg("error.send_pending")));
        sending = true;
        try {
          const current = await state();
          if (current !== "waiting") throw Object.assign(new Error(withMessage(msg("error.session_not_idle"))), { code: "session_not_idle" });
          markSent(text);
          await session.send({ prompt: text, mode: "enqueue" });
          lastSent = Date.now();
        } catch (error) {
          sent.delete(text);
          throw error;
        } finally {
          sending = false;
        }
        result = { accepted: true };
      } else throw unavailable(`${name} is not available in the Copilot canvas.`);
      return result;
    }
  };
}

// src/capabilities.ts
var UNSUPPORTED_SETTINGS = /* @__PURE__ */ new Set(["allowTerminalRead", "allowOtherAgents", "allowAgentActivity", "allowEditorSaves", "allowAgentLaunch", "allowOpenFiles", "notifyWhenDone"]);

// src/copilot/sent.ts
import { createHash } from "node:crypto";
var sentKey = (sessionId, text) => `sent:${createHash("sha256").update(sessionId).update("\0").update(text).digest("hex")}`;

// src/copilot/services.ts
function createServices(session, directory = process.env.ENHANCE_PROMPT_DATA_DIR || join6(process.env.LOCALAPPDATA || join6(homedir3(), ".local", "share"), "copilot-enhance-prompt"), copilot) {
  const data = persistentStore(join6(directory, "data"));
  const prefs = persistentStore(join6(directory, "preferences"));
  const secrets = protectedSecrets(persistentStore(join6(directory, "credentials")));
  const adapter = sessionAdapter({ sessionId: session.sessionId, rpc: session.rpc, send: async (options) => {
    const key = sentKey(session.sessionId, options.prompt);
    await data.transaction(async () => {
      for (const old of (await data.keys()).filter((key2) => key2.startsWith("sent:"))) {
        if (Number(await data.get(old)) < Date.now()) await data.delete(old);
      }
      await data.set(key, Date.now() + 12e4);
    });
    try {
      return await session.send(options);
    } catch (error) {
      await data.delete(key);
      throw error;
    }
  } });
  const settings = {
    get: (async (key) => {
      const values = { ...DEFAULTS };
      for (const name of await prefs.keys()) if (Object.hasOwn(DEFAULTS, name)) values[name] = await prefs.get(name);
      for (const name of UNSUPPORTED_SETTINGS) values[name] = false;
      return key === void 0 ? values : values[key];
    }),
    set: async (key, value) => {
      if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) throw new Error("Invalid setting.");
      if (UNSUPPORTED_SETTINGS.has(key) && value) throw new Error("This setting is unavailable in the Copilot canvas.");
      await prefs.set(key, value);
    },
    onDidChange: (listener) => prefs.onDidChange(listener)
  };
  const scope = createHash2("sha256").update(session.sessionId).digest("hex").slice(0, 24);
  const scopeKey = (key) => key.startsWith("panel:") ? `session:${scope}:${key}` : key;
  const storage = {
    get: (key) => data.get(scopeKey(key)),
    set: (key, value) => data.set(scopeKey(key), value),
    delete: (key) => data.delete(scopeKey(key)),
    keys: async () => (await data.keys()).filter((key) => !key.startsWith("session:") || key.startsWith(`session:${scope}:`)).map((key) => key.replace(`session:${scope}:`, "")),
    onDidChange: (listener) => data.onDidChange(({ key }) => {
      if (!key.startsWith("session:") || key.startsWith(`session:${scope}:`)) listener({ key: key.replace(`session:${scope}:`, "") });
    }),
    transaction: data.transaction
  };
  const host = {
    has: (name) => Boolean(copilot) && ["copilot.catalog", "copilot.rewrite"].includes(name) || name === "secrets.protection" || adapter.has(name),
    call: async (name, input, options) => name === "copilot.catalog" && copilot ? await copilot.catalog() : name === "copilot.rewrite" && copilot ? { text: await copilot.rewrite(input, options?.signal) } : name === "secrets.protection" ? { status: secrets.available ? "os-keyring" : "unavailable", backend: "DPAPI" } : adapter.call(name, input, options)
  };
  return { storage, settings, secrets, host, adapter, directory, data };
}

// src/copilot/hook.ts
async function rewriteTransformed(input, rewrite) {
  const { prompt, transformedPrompt } = input;
  const at = prompt ? transformedPrompt.indexOf(prompt) : -1;
  if (at < 0 || transformedPrompt.indexOf(prompt, at + 1) >= 0) return {};
  try {
    const enhanced = terminalSafe(await rewrite()).trim();
    if (!enhanced || enhanced === prompt) return {};
    return { modifiedTransformedPrompt: transformedPrompt.slice(0, at) + enhanced + transformedPrompt.slice(at + prompt.length) };
  } catch {
    return {};
  }
}
async function runPromptHook(input, directory) {
  if (typeof input.sessionId !== "string" || typeof input.cwd !== "string" || !isAbsolute4(input.cwd) || typeof input.prompt !== "string" || typeof input.transformedPrompt !== "string" || input.agentId) return {};
  const { sessionId, cwd, prompt, transformedPrompt } = input;
  const session = {
    sessionId,
    rpc: {
      metadata: { snapshot: async () => ({ workingDirectory: cwd, isRemote: false }), activity: async () => ({ hasActiveWork: true }), isProcessing: async () => ({ processing: true }) },
      permissions: { pendingRequests: async () => ({ items: [] }) },
      queue: { pendingItems: async () => ({ items: [], steeringMessages: [] }) }
    },
    send: async () => {
      throw new Error("A prompt hook cannot send a message.");
    }
  };
  const services = createServices(session, directory);
  const bypass = await services.storage.transaction(async () => {
    const key = sentKey(sessionId, prompt);
    const until = await services.storage.get(key);
    if (until !== null) await services.storage.delete(key);
    return typeof until === "number" && until > Date.now();
  });
  if (bypass) return {};
  const worker = createWorkerHost(services);
  activate(worker.api);
  try {
    const settings = await readSettings(worker.api);
    if (settings.autoEnhanceMode === "off") return {};
    return await rewriteTransformed({ prompt, transformedPrompt }, async () => {
      if (settings.autoEnhanceMode === "ai" && settings.autoEnhanceContext && settings.privacy.allowProjectFiles) {
        await staticParts(cwd, settings.extraContextFiles, true, settings.privacy.allowGit);
      }
      const result = await worker.hooks.fire("agent.prompt.before", { prompt, terminalId: sessionId, agent: "copilot" });
      const last = await worker.request("hook.last");
      if (last) await services.storage.set("panel:hookLast", last);
      await withHistory(async () => {
      });
      return result.event.prompt;
    });
  } finally {
    await worker.deactivate();
  }
}

// src/copilot/hook-entry.ts
var deadline = setTimeout(() => {
  process.stdout.write("{}");
  process.exit(0);
}, 4500);
try {
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk.toString();
    if (text.length > 25e5) throw new Error("Hook input too large");
  }
  const result = await runPromptHook(JSON.parse(text));
  clearTimeout(deadline);
  process.stdout.write(JSON.stringify(result));
} catch {
  clearTimeout(deadline);
  process.stdout.write("{}");
}
