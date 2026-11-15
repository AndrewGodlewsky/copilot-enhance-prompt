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

// src/format.ts
function formatText(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
}

// src/messages.ts
var MESSAGES = {
  // Text from outside the plugin (a provider's error, a file name) stays verbatim.
  raw: "{text}",
  // Context notes: why something was left out.
  "note.no_workspace": "No focused workspace.",
  "note.workspace_unknown": "Could not tell which folder the workspace is in; project files skipped.",
  "note.remote": "Remote (SSH/WSL) workspace: project files are not readable from the plugin.",
  "note.terminal_off": "Terminal output is off in Settings.",
  "note.not_git": "Git context is unavailable for this project. Local file search still works.",
  "note.git_off": "Git access is off. Local file search still works.",
  "note.no_files": "No files matched the prompt; the agent will be told to locate them.",
  "note.search_limited": "Local content search reached its file, size, or time limit. Name relevant files in your request to prioritize them.",
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
  "error.effort": "Choose Low, Medium, or High effort.",
  "error.effort_model": "The model assigned to {effort} effort is unavailable. Choose an enabled model in Settings \u2192 Effort models.",
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
  "error.copilot_usage": "Copilot usage could not be saved. Check free disk space and plugin data-folder permissions, then open Show Logs. Any remaining helper files have been kept for recovery.",
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
function render(message) {
  const param = (value) => {
    if (Array.isArray(value)) return value.map(param).join(" \xB7 ");
    if (isMessage(value)) return render(value);
    return String(value);
  };
  const params = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of Object.entries(message.params ?? {})) params[key] = param(value);
  return formatText(MESSAGES[message.code], params);
}
function english(message) {
  return render(message);
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
  /** The message as a code and parameters, for structured error handling. */
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
import { basename, dirname, isAbsolute, join as join3, relative, sep } from "node:path";
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
function fileAllowed(policy = {}) {
  const patterns = compilePatterns(policy.excludePatterns ?? "");
  const normalize = (path) => process.platform === "win32" ? path.toLowerCase() : path;
  const unchecked = new Set([...policy.exclude ?? []].filter((id2) => /^(file|rules):/.test(id2)).map((id2) => normalize(id2.slice(id2.indexOf(":") + 1).replace(/\\/g, "/"))));
  return (path) => {
    path = path.replace(/\\/g, "/");
    return !isSensitive(path) && !isBinaryPath(path) && !isExcluded(path, patterns) && !unchecked.has(normalize(path));
  };
}
async function projectFileAllowed(root, policy = {}) {
  const exclude = new Set(policy.exclude);
  const base = await realpath(root).catch(() => null);
  if (!base) return () => false;
  const resolved = /* @__PURE__ */ new Map();
  const canonical = (full) => {
    let value = resolved.get(full);
    if (!value) {
      value = realpath(full).catch(async (error) => {
        if (error.code !== "ENOENT" || full === base || dirname(full) === full) return null;
        const parent = await realpath(dirname(full)).catch(() => null);
        return parent ? join3(parent, basename(full)) : null;
      });
      resolved.set(full, value);
    }
    return value;
  };
  const localPath = async (path) => {
    if (isAbsolute(path) || path.split(/[\\/]/).includes("..")) return null;
    const actual = await canonical(join3(base, path));
    if (!actual) return null;
    const local = relative(base, actual).split(sep).join("/");
    return local.startsWith("..") || isAbsolute(local) ? null : local;
  };
  for (const id2 of policy.exclude ?? []) {
    if (!/^(file|rules):/.test(id2)) continue;
    const local = await localPath(id2.slice(id2.indexOf(":") + 1));
    if (local !== null) exclude.add(`file:${local}`);
  }
  const lexical = fileAllowed({ ...policy, exclude });
  return async (path) => {
    if (!lexical(path)) return false;
    const local = await localPath(path);
    return local !== null && lexical(local + (path.endsWith("/") ? "/" : ""));
  };
}
async function filterAllowed(paths, allow, signal) {
  const result = [];
  for (let i = 0; i < paths.length; i += 64) {
    signal?.throwIfAborted();
    const batch = paths.slice(i, i + 64);
    const allowed = await Promise.all(batch.map(allow));
    result.push(...batch.filter((_, index) => allowed[index]));
  }
  return result;
}
async function walkFiles(root, maxFiles = 8e3, maxDepth = 6, signal, allow = () => true) {
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
      const path = relative(root, join3(dir, entry.name)).split(sep).join("/");
      if (entry.isDirectory()) {
        if (await allow(`${path}/`) && !WALK_SKIP.has(entry.name) && (!entry.name.startsWith(".") || path === ".github" || path === ".cursor")) {
          await visit(join3(dir, entry.name), depth + 1);
        }
      } else if (entry.isFile() && await allow(path)) {
        out.push(path);
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
async function readText(root, path, maxBytes = 2e5, allow = () => true) {
  if (!await allow(path) || isSensitive(path) || isBinaryPath(path) || path.includes("..")) {
    return null;
  }
  try {
    const full = join3(root, path);
    const info = await stat2(full);
    if (!info.isFile() || info.size > maxBytes) {
      return null;
    }
    const actual = relative(await realpath(root), await realpath(full)).split(sep).join("/");
    if (actual.startsWith("..") || isAbsolute(actual) || isSensitive(actual) || !await allow(actual)) {
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

// src/effort.ts
var EFFORTS = ["low", "medium", "high"];
var EFFORT_LABELS = { low: "Low", medium: "Medium", high: "High" };
var EFFORT_SETTINGS = { low: "effortLowModel", medium: "effortMediumModel", high: "effortHighModel" };
var isEffort = (value) => EFFORTS.some((effort) => effort === value);
var MODEL_SEP = "|";
var PROFILE_DEFAULT = "__profile_default__";
function modelAssignment(profileId, model) {
  return `${profileId}${MODEL_SEP}${model || PROFILE_DEFAULT}`;
}
function parseModelAssignment(value) {
  if (value === "auto") return { profileId: null, model: "" };
  if (typeof value !== "string" || value.length > 500) return null;
  const parts = value.split(MODEL_SEP);
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts.some((part) => part !== part.trim() || /[\r\n\x00]/.test(part))) return null;
  return { profileId: parts[0], model: parts[1] === PROFILE_DEFAULT ? "" : parts[1] };
}

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
    if ((await filterAllowed(paths, (path) => !isSensitive(path) && allow(path), signal)).length !== paths.length) paths.forEach((path) => refused.add(path));
  }
  if (refused.size > MAX_DIFF_EXCLUSIONS) return null;
  const pathspecs = [...SAFE_PATHSPECS, ...[...refused].map((path) => `:(exclude,literal)${path}`)];
  const stat4 = await git(root, ["diff", "HEAD", "-M", "--stat=100", "--no-ext-diff", "--no-textconv", "--", ...pathspecs], { signal });
  if (stat4 === null || !stat4.trim()) {
    return null;
  }
  const diff = await git(root, ["diff", "HEAD", "-M", "-U2", "--no-ext-diff", "--no-textconv", "--", ...pathspecs], { maxBytes: 4e6, signal }) ?? "";
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
async function gitGrepCount(root, word, signal, refused = []) {
  const counts = /* @__PURE__ */ new Map();
  const out = await git(root, ["grep", "-c", "-I", "-i", "-F", "--untracked", "--exclude-standard", "-e", word, "--", ...SAFE_PATHSPECS, ...refused.map((path) => `:(exclude,literal)${path}`)], {
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
async function readRuleFiles(root, fileList, extra, budget, allow = () => true) {
  const present = new Set(fileList);
  const cursorRules = fileList.filter((f) => f.startsWith(".cursor/rules/") && /\.mdc?$/.test(f)).slice(0, 4);
  const names = [.../* @__PURE__ */ new Set([...extra, ...RULE_FILES, ...cursorRules])];
  const out = [];
  let used = 0;
  for (const name of names) {
    if (used >= budget) break;
    if (!await allow(name)) continue;
    if (!present.has(name) && !extra.includes(name)) continue;
    const text = await readText(root, name, void 0, allow);
    if (!text?.trim()) continue;
    const mask = /\.(md|mdc|rst|txt)$/i.test(name) || RULE_FILES.includes(name) ? redactSecrets : redactCode;
    const content = cap(mask(text.trim()), Math.min(4e3, budget - used));
    used += content.length;
    out.push({ name, content });
  }
  const readme = fileList.find((f) => /^readme(\.md|\.rst|\.txt)?$/i.test(f));
  if (readme && used < budget) {
    const text = await readText(root, readme, void 0, allow);
    if (text?.trim()) {
      out.push({ name: readme, content: readmeDigest(redactSecrets(text), Math.min(3500, budget - used)) });
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
    const idf = Math.log(1 + (totalFiles + 1) / (df + 1));
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
    const manager = pkg.packageManager?.split("@")[0] ?? (files.has("pnpm-lock.yaml") ? "pnpm" : files.has("yarn.lock") ? "yarn" : files.has("bun.lockb") || files.has("bun.lock") ? "bun" : files.has("package-lock.json") ? "npm" : null);
    out.push(`Node project${pkg.name ? ` "${pkg.name}"` : ""}, package manager: ${manager ?? "not established from permitted files"}${pkg.workspaces ? " (monorepo workspaces)" : ""}`);
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    if (deps.length > 0) {
      out.push(`Key dependencies: ${deps.slice(0, 30).join(", ")}${deps.length > 30 ? ", \u2026" : ""}`);
    }
    const scripts = Object.entries(pkg.scripts ?? {});
    if (scripts.length > 0) {
      out.push(manager ? `Scripts (run with "${manager} run <name>"):` : "Scripts (package manager unspecified):");
      for (const [name, command] of scripts.slice(0, 25)) {
        out.push(`  ${name}: ${truncate(redactSecrets(command), 120)}`);
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
async function detectStack(root, fileList, allow = () => true) {
  const files = new Set(fileList.filter((file) => !file.includes("/")));
  const out = [];
  const read = async (name) => {
    const text = files.has(name) ? await readText(root, name, 3e5, allow) : null;
    return text === null ? null : name === "package.json" ? redactCode(text) : redactSecrets(text);
  };
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

// src/context/search.ts
async function searchFiles(root, files, words, allow, signal) {
  const counts = words.map(() => /* @__PURE__ */ new Map());
  const hits = /* @__PURE__ */ new Map();
  let read = 0;
  let bytes = 0;
  const started = Date.now();
  for (const file of words.length ? files : []) {
    if (signal?.aborted || read >= 300 || bytes >= 4e6 || Date.now() - started >= 1500) break;
    read++;
    const text = await readText(root, file, Math.min(2e5, 4e6 - bytes), allow);
    if (text === null) continue;
    bytes += Buffer.byteLength(text);
    const lines = [];
    text.split(/\r?\n/).forEach((line, index) => {
      const lower = line.toLowerCase();
      let matched = false;
      words.forEach((word, wordIndex) => {
        if (lower.includes(word.toLowerCase())) {
          counts[wordIndex].set(file, (counts[wordIndex].get(file) ?? 0) + 1);
          matched = true;
        }
      });
      if (matched && lines.length < 20) lines.push(index + 1);
    });
    if (lines.length) hits.set(file, lines);
  }
  return { counts, hits, limited: words.length > 0 && read < files.length };
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
var staticKey = (extraFiles, allowGit, policy) => JSON.stringify([extraFiles, allowGit, policy.excludePatterns ?? "", [...policy.exclude ?? []].sort()]);
function cachedStatic(root, settings) {
  const hit = staticCache.get(root);
  const key = settings && staticKey(settings.extraContextFiles, settings.privacy.allowGit, settings);
  return hit && (!key || hit.key === key) && Date.now() - hit.at < STATIC_TTL_MS ? hit : null;
}
async function staticParts(root, extraFiles, fresh = false, allowGit = true, signal, onProgress = () => void 0, policy = {}) {
  const key = staticKey(extraFiles, allowGit, policy);
  const hit = staticCache.get(root);
  if (hit?.key === key && !fresh && Date.now() - hit.at < STATIC_TTL_MS) return hit;
  const allow = await projectFileAllowed(root, policy);
  const isGit = allowGit && await isGitRepo(root, signal);
  onProgress(0.15);
  const listed = (isGit ? await gitFiles(root, signal) : null) ?? await walkFiles(root, void 0, void 0, signal, allow);
  stopIfCancelled(signal);
  onProgress(0.5);
  const files = await filterAllowed([...new Set(listed)], allow, signal);
  const permitted = new Set(files);
  const refused = listed.filter((path) => !permitted.has(path));
  const items = [];
  for (const rule of await readRuleFiles(root, files, extraFiles, 9e3, allow)) {
    items.push(item(`rules:${rule.name}`, "rules", raw(rule.name), rule.content));
  }
  onProgress(0.8);
  const stack = policy.exclude?.has("stack") ? null : await detectStack(root, files, allow);
  if (stack) items.push(item("stack", "stack", msg("label.stack"), stack));
  if (files.length > 0 && !policy.exclude?.has("tree")) items.push(item("tree", "tree", msg("label.tree", { count: files.length }), redactSecrets(treeSummary(files))));
  stopIfCancelled(signal);
  const parts = { at: Date.now(), key, files, refused, isGit, items };
  staticCache.set(root, parts);
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
    const parts = await staticParts(root, options.extraFiles, true, options.allowGit !== false, signal, (fraction) => step("project", "running", void 0, fraction), options);
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
  const allow = await projectFileAllowed(root, options);
  const alreadyIncluded = new Set(parts.items.filter((entry) => entry.kind === "rules").map((entry) => entry.label));
  const isProse = (file) => /\.(md|mdx|rst|txt)$/i.test(file);
  const files = (await filterAllowed(parts.files, allow, options.signal)).filter((file) => {
    if (alreadyIncluded.has(file)) return false;
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
      counted(skip("git:diff") ? null : gitDiff(root, diffChars, allow, signal))
    ]);
    stopIfCancelled(signal);
    if (status && !skip("git:status") && (status.changed.length > 0 || status.branchLine)) {
      const shown = await filterAllowed(status.changed, async (line) => {
        const paths = statusLinePaths(line);
        return (await filterAllowed(paths, allow, signal)).length === paths.length;
      }, signal);
      out.push(
        item(
          "git:status",
          "git",
          msg("label.status", { count: shown.length }),
          redactSecrets([status.branchLine && `## ${status.branchLine}`, ...shown.slice(0, 60)].filter(Boolean).join("\n"))
        )
      );
    }
    if (status) changed = /* @__PURE__ */ new Set([...changedPaths(status.changed), ...saved]);
    if (log?.trim()) out.push(item("git:log", "git", msg("label.log"), redactSecrets(log.trim())));
    if (diff) out.push(item("git:diff", "git", msg("label.diff"), `${diff.stat}

${diff.diff}`));
    step("git", "done", String(changed.size));
  } else {
    notes.push(msg(options.allowGit === false ? "note.git_off" : "note.not_git"));
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
  const useGitSearch = parts.isGit && parts.refused.join("").length < 5e3 && parts.refused.length < 100;
  const likely = scoreFiles(files, weighted, /* @__PURE__ */ new Map(), changed, true).map((entry) => entry.path);
  const local = !useGitSearch ? await searchFiles(root, [.../* @__PURE__ */ new Set([...likely, ...files])], grepWords, allow, signal) : null;
  if (local?.limited) notes.push(msg("note.search_limited"));
  const perWord = useGitSearch ? await Promise.all(
    grepWords.map(
      (word) => gitGrepCount(root, word, signal, parts.refused).then((counts) => {
        searched++;
        step("search", "running", void 0, searched / grepWords.length * 0.9);
        return counts;
      })
    )
  ) : local?.counts ?? [];
  stopIfCancelled(signal);
  const content = contentScores(perWord, files.length, grepTargets.map((entry) => entry.weight));
  const mentionsTests = /\btest|spec|kiểm thử/i.test(options.prompt);
  const scored = scoreFiles(files, weighted, content, changed, mentionsTests);
  let picked = scored.slice(0, RELEVANT_FILES[options.level]).map((entry) => ({ path: entry.path, hits: [], why: msg("why.keyword") }));
  step("search", "done", String(picked.length));
  if (options.level === "max" && (!options.pickFiles || files.length === 0)) step("pick", "skipped");
  if (options.level === "max" && options.pickFiles && files.length > 0) {
    step("pick", "running");
    try {
      const shortlist = [.../* @__PURE__ */ new Set([...scored.slice(0, 150).map((s) => s.path), ...files])].slice(0, 600);
      const chosen = await options.pickFiles(shortlist, options.prompt);
      const ai = [...new Set(chosen.filter((path) => files.includes(path)))].slice(0, 8);
      picked = [...ai.map((path) => ({ path, hits: [], why: msg("why.ai") })), ...picked.filter((entry) => !ai.includes(entry.path))].slice(0, RELEVANT_FILES.max);
      step("pick", "done", String(picked.length));
    } catch (error) {
      stopIfCancelled(signal);
      notes.push(msg("note.picker_skipped", { reason: messageOf(error) }));
      step("pick", "skipped");
    }
  }
  stopIfCancelled(signal);
  const lines = useGitSearch ? await gitGrep(root, grepWords, picked.map((entry) => entry.path), void 0, signal) : local?.hits ?? /* @__PURE__ */ new Map();
  stopIfCancelled(signal);
  for (const entry of picked) entry.hits = lines.get(entry.path) ?? [];
  const perFile = options.level === "max" ? 1800 : 1400;
  for (const entry of picked) {
    if (options.exclude.has(`file:${entry.path}`)) continue;
    const text = await readText(root, entry.path, void 0, allow);
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
import { basename as basename2, isAbsolute as isAbsolute2, join as join4, relative as relative2, resolve } from "node:path";

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
  const cleaned = basename2(name).replace(/[^\p{L}\p{N}._ -]+/gu, "_").replace(/^\.+/, "").trim().slice(0, 120);
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
    if (!info || !info.isFile()) throw new LlmError(msg("error.attachment_missing", { name: basename2(path) }), "invalid_params");
    if (info.size > MAX_ATTACHMENT_BYTES) {
      throw new LlmError(msg("error.file_too_large", { name: basename2(path), size: sizeOver(info.size, MAX_ATTACHMENT_BYTES), max: megabytes(MAX_ATTACHMENT_BYTES) }), "too_large");
    }
    const bytes = await readFile4(path);
    out.paths.push(path);
    const type = sniffImage(bytes.subarray(0, 16));
    if (type && info.size <= MAX_IMAGE_BYTES && out.images.length < MAX_IMAGES) {
      out.images.push({ path, name: basename2(path), bytes: info.size, type, base64: bytes.toString("base64") });
      continue;
    }
    if (type || bytes.includes(0)) continue;
    const { text: content, cut } = excerpt(bytes.toString("utf8"));
    out.texts.push({ path, name: basename2(path), content, cut });
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
  /** The message as a code and parameters, for structured error handling. */
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
      const accountingFailed = messageOf(caught).code === "error.copilot_usage";
      const error = ranOut && !options.signal?.aborted && !accountingFailed ? new LlmError(msg("error.model_timeout", { model: model || profile.name, seconds: Math.max(1, Math.round(limit / 1e3)) }), "timeout") : caught;
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
      if (accountingFailed) throw new ChainError(messageOf(error), "action_failed", attempts);
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
function isStyle(value) {
  return typeof value === "string" && STYLES.includes(value);
}
var BASE = `You are a prompt engineer for AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode and similar).
Rewrite the user's rough request into a clear, specific, actionable prompt that the agent can execute well.

Rules:
- Preserve whether the user asked for implementation, investigation, explanation, review or a plan. A style organizes the request; it does not authorize additional work.
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
- Say when the agent should stop and ask: only for a blocking unknown or an action that is hard to undo. Name the actions that apply to this task (deleting data, force-pushing, publishing, changing shared systems) instead of a general "ask before anything risky". Within the requested scope and any planning or review boundary, it picks the most reasonable option, states it as an assumption and carries on. When the request itself approves an action ("run the migration on staging"), write it as approved.
- Ask for evidence at the end: the agent reports the commands it ran and what they printed (or what it observed), not just "it works".
- Leave the agent's way of working to the agent unless the user asked otherwise: no "think step by step" or "think hard", no request to show or write out its reasoning (the model's safety checks can refuse that; ask for findings and evidence instead), no token or time budget, and no instruction to delegate to subagents.
- Keep the instructions consistent: never give two that pull against each other (for example "wait for my confirmation" and "proceed without asking"); pick one.
- When the request has <attached_images>, they are screenshots or pictures the user attached. If you can see them, use what they show (error text, layout, values) to make the prompt precise. Always tell the agent to open each image by its exact path, and never describe what you cannot see.
- Output just the final prompt text, starting with its first line: no preamble, no explanation, no surrounding code fence.`;
var IMPLEMENTATION_RULES = `Larger tasks. Only when the request asks for implementation and has several steps or touches several files, the prompt also says these three things, each in a sentence or two of its own words, placed where they fit the shape (for example with the constraints and at the end):
1. Finish all of it. Include these two sentences in English, as the last lines of the constraints (in a shape without such a section, as a short paragraph of their own before the reporting): "Complete every part of this task before you end your turn. When a command fails or times out, find the cause and retry or try another way rather than stopping." Agents otherwise tend to stop part-way with a list of what remains or an offer to continue, and a prompt for a larger task that lacks these two sentences is not finished: check that they are there before you answer. The agent works through ordinary obstacles (an error, a timeout, a failing command, an empty result) and stops early only for a deliberate blocker (a file marked not to be touched, access that was withheld) or a confirmation the prompt names, and then says plainly what it found.
2. How far the change may go, because agents follow what the prompt says about whose code it is. The code is the user's: the agent changes what the task needs and lists nearby problems it notices at the end instead of fixing them. Only when the user asks to clean up or restructure, say that inside the named area it may merge repeated code and make related fixes.
3. Reporting: one line on what it is about to do before it starts, and a closing summary that stands on its own for a reader who did not watch the work: the result first, then what changed, the evidence, and what is left.
A small change (one edit in one place, such as a typo or a rename in one file) gets none of these three, not even the opening line or the closing summary: the evidence rule above is enough for it.`;
var STYLE_RULES = {
  balanced: {
    intent: "Turn a general-purpose request into clear, actionable instructions. Match the detail to the task and keep small requests small.",
    shape: "Shape: a one-line goal, then short sections only where useful: Context, Requirements, Constraints, Done when."
  },
  concise: {
    intent: "Compress the request without changing its meaning. Brevity must not remove concrete details, user-provided reasons, constraints, errors, paths or blocking questions. Prefer one relevant verification command supplied in the request or context. If no command is supplied, ask the agent to find the appropriate check. Omit implementation-workflow boilerplate.",
    shape: "Shape: a tight, unambiguous prompt. Aim for at most four short sentences, roughly 25 words each, on separate lines without headings. Exceed that target when needed to preserve the request. Include verification in the last sentence where relevant."
  },
  detailed: {
    intent: "Develop a precise specification with acceptance criteria grounded in the request. Separate known requirements from genuine unknowns; do not invent edge cases, product decisions or extra deliverables to fill sections.",
    shape: "Shape: Goal, Background, Requirements (numbered), Constraints / non-goals, Edge cases, Acceptance criteria, Deliverables. Omit sections that add nothing; even a detailed spec should be proportional to the task."
  },
  bugfix: {
    intent: "Ask the agent to find the root cause before changing code. Distinguish observed symptoms from expected behavior and hypotheses. Use supplied reproduction steps; if missing, ask the agent to reproduce or diagnose instead of inventing them. Keep the fix minimal, report unrelated problems, and add or update a regression test when the bug changes behavior.",
    shape: "Shape: Symptom (actual vs expected), Reproduction steps (if known), Suspected area (evidence or labeled hypotheses), Investigation, Fix requirements, Verification."
  },
  feature: {
    intent: "Describe the requested user-visible behavior and user value, including relevant UI or API changes. Follow existing patterns and add dependencies only when needed. Keep unspecified product decisions open and choose tests appropriate to the requested feature.",
    shape: "Shape: Goal and user value, Behavior / requirements, UI or API surface (if relevant), Constraints, Tests, Done when. Skip empty sections."
  },
  refactor: {
    intent: "Restructure the named code and preserve existing behavior unless the current request explicitly names a behavior change. Inside the target code the agent may merge repeated code and reshape it as needed; keep unrelated code outside the scope. Use small safe increments and existing tests; add characterization tests first where relevant coverage is missing.",
    shape: "Shape: Target code, Motivation, Desired structure (if known), Scope, Behavior to preserve, Steps, Verification. If no design is supplied, ask the agent to choose a suitable structure after inspecting the code."
  },
  review: {
    intent: "Request an evidence-based code review with findings grouped by severity, file:line references and suggested fixes. Prioritize correctness, regressions, security and missing tests; include performance or readability issues when concrete. Report no findings when none are supported, and distinguish unverified concerns. Review does not authorize code changes.",
    shape: "Shape: What to review (diff, branch or files), Relevant focus areas, Findings format, Validation and remaining uncertainty."
  },
  plan: {
    intent: "Ask the agent to inspect the relevant code, propose a practical plan and stop after the plan. Include ordered steps, risks, blocking questions and proposed verification. Distinguish checks already performed during investigation from checks planned for implementation.",
    shape: "Shape: Goal, Known requirements, Proposed steps, Risks / open questions, Verification plan, Approval boundary."
  },
  custom: {
    intent: "Let the custom instructions define the prompt while preserving the request, grounded facts and shared output policy. Do not impose another built-in style or implementation-workflow template.",
    shape: "Shape: follow the custom instructions from the user; use only the structure they request."
  }
};
var AGENT_HINTS = [
  {
    match: /copilot/i,
    hint: "Target is GitHub Copilot in the attached project. Keep the selected style and structure, and name only relevant paths and checks supported by the request or context. Do not assume a separate terminal agent or claim the project is unavailable."
  },
  {
    match: /claude/i,
    hint: "Target is Claude Code: keep the selected style and structure. When headings are needed and the user has not specified another format, prefer Markdown. Leave how it plans and tracks the work to it."
  },
  {
    match: /codex/i,
    hint: "Target is OpenAI Codex CLI: use direct instructions and grounded file paths and checks within the selected style and structure."
  },
  {
    match: /gemini/i,
    hint: "Target is Gemini CLI: keep the selected style and structure, with clear actions, grounded file paths and relevant verification."
  },
  {
    match: /aider/i,
    hint: "Target is Aider: identify files to add to the chat only when supported by the request or context; keep the selected style and structure."
  },
  {
    match: /opencode|amp|cursor|droid|pi\b|qwen|kimi|goose|cline/i,
    hint: "Target is a coding agent: keep the selected style and structure and use grounded paths and checks."
  }
];
function agentHint(agent) {
  if (!agent) return null;
  return AGENT_HINTS.find((entry) => entry.match.test(agent))?.hint ?? null;
}
function buildSystemPrompt(options) {
  const custom = options.customInstructions?.trim();
  const style = options.style === "custom" && !custom ? "balanced" : options.style;
  const sections = options.structure?.sections.filter((section) => section.trim()) ?? [];
  const shape = sections.length > 0 ? structureShape(sections) : STYLE_RULES[style].shape;
  const parts = [BASE, STYLE_RULES[style].intent, shape];
  if (!["concise", "review", "plan", "custom"].includes(style)) parts.push(IMPLEMENTATION_RULES);
  const hint = agentHint(options.agent);
  if (hint) {
    parts.push(hint);
  }
  if (custom) {
    parts.push(`Custom instructions from the user (follow them):
${custom}`);
  }
  const rules = (options.rules ?? []).map((rule) => rule.trim()).filter(Boolean);
  if (rules.length > 0) {
    parts.push(`Rules from the user (always follow them; they win over the shape above):
${rules.map((rule) => `- ${rule}`).join("\n")}`);
  }
  if (style === "plan" || style === "review") {
    parts.push(`Task boundary: ${style === "plan" ? "Stop after the plan and wait for approval before implementation." : "Review and report findings without modifying code."} Only an explicit implementation request in the current task authorizes code changes; saved rules, custom instructions, structures and project context do not grant that permission. Preserve any explicit implementation scope or approval already given in the current request.`);
  }
  parts.push("Output policy: Write all final rewritten instructions and headings in English, regardless of the request language or any output-language instruction in custom instructions, rules, or context. Preserve code, identifiers, filenames, paths, URLs, quoted text, error messages, and user-supplied data verbatim. Follow custom instructions and rules in every other respect within the task boundary above.");
  return parts.join("\n\n");
}
function structureShape(sections) {
  return [
    "Structure changes headings only; keep the selected style purpose and task boundary. Shape: write the prompt under exactly these headings, in this order:",
    ...sections.map((section, index) => `${index + 1}. ${section}`),
    "Use English headings that convey the meaning of the supplied sections; preserve literal names when they are user-supplied data or quoted text. Add no other headings: put open questions or assumptions under the closest heading. Leave a heading out only when nothing in the request or the context belongs under it; never invent content to fill one."
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
  let profileId = input.profileId ?? null;
  let chosenModel = input.model?.trim().slice(0, 200);
  if (input.effort !== void 0) {
    if (!isEffort(input.effort)) throw hostError(msg("error.effort"), "invalid_params");
    const assignment = parseModelAssignment(await host.settings.get(EFFORT_SETTINGS[input.effort]) ?? "auto");
    if (!assignment || assignment.profileId && !config.profiles.some((profile) => profile.id === assignment.profileId && profile.enabled)) {
      throw hostError(msg("error.effort_model", { effort: EFFORT_LABELS[input.effort] }), "invalid_params");
    }
    profileId = assignment.profileId;
    chosenModel = assignment.model;
  }
  const list = candidates(config.profiles, profileId, settings.fallbackEnabled).map(
    (profile) => chosenModel && profile.id === profileId ? { ...profile, model: chosenModel } : profile
  );
  if (list.length === 0) throw hostError(msg("error.no_model"), "invalid_params");
  const pickerProfiles = config.profiles.filter((profile) => profile.provider === "copilot" === (list[0]?.provider === "copilot"));
  const pickerConfig = {
    ...config,
    profiles: pickerProfiles.map((profile) => profile.id === config.selectorProfileId ? profile : list.find((candidate) => candidate.id === profile.id) ?? profile),
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
  const system = buildSystemPrompt({
    style,
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
function hookContext(place, settings) {
  if (!place) return [];
  const items = [{ id: "workspace", kind: "workspace", label: "Workspace", content: place.label, chars: place.label.length }];
  if (!settings.privacy.allowProjectFiles) return items;
  const cached = place.workspace && isLocalWorkspace(place.workspace) ? cachedStatic(place.workspace.path, settings) : null;
  if (cached) items.push(...cached.items.filter((entry) => entry.kind !== "tree"));
  return items;
}
var SIDEBAR_KEY = process.platform === "darwin" ? "\u2318L" : "Ctrl+L";
var statusBarText = (mode) => `${BRAND_SHORT}: ${mode === "off" ? "Off" : "On"}`;
var WORKER_WORDS = {
  modes: { off: "off", rules: "on (rules)", ai: "on (AI)" },
  tooltip: (mode) => `Click: open the right sidebar (${SIDEBAR_KEY}), then the lightbulb tab "${BRAND}".
Auto-enhance is ${mode}. Change it under the panel's gear icon or in the command palette.
Settings and updates: Settings \u2192 Plugins \u2192 Enhance Prompt.`,
  answer: (mode) => `Auto-enhance is ${mode}.`,
  bar: { hidden: "Status bar item hidden.", shown: "Status bar item shown." }
};
function modeAnswer(mode) {
  return WORKER_WORDS.answer(WORKER_WORDS.modes[mode]);
}
async function refreshStatusBar(host) {
  if (!host.host.has("statusBar.update")) return;
  const all = await host.settings.get();
  const { autoEnhanceMode } = await readSettings(host);
  const display = typeof all.statusBarItem === "string" ? all.statusBarItem : "full";
  const words = WORKER_WORDS;
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
  return modeAnswer(mode);
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
      for (const key of Object.values(EFFORT_SETTINGS)) await host.settings.set(key, "auto");
      await host.storage.delete(RULES_KEY);
      await host.storage.delete(CONSENTS_KEY);
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
      const items = settings.autoEnhanceContext ? hookContext(place, settings) : [];
      if (settings.autoEnhanceContext && settings.privacy.allowProjectFiles && place?.workspace && isLocalWorkspace(place.workspace) && !cachedStatic(place.workspace.path, settings)) {
        const root = place.workspace.path;
        if (!warming.has(root)) {
          warming.add(root);
          void staticParts(root, settings.extraContextFiles, true, settings.privacy.allowGit, void 0, void 0, settings).catch(() => void 0).finally(() => warming.delete(root));
        }
      }
      const rules = rulesFor(parseRulesConfig(await host.storage.get(RULES_KEY).catch(() => null)), place?.where ?? { workspace: null, project: null });
      const system = buildSystemPrompt({
        style: settings.defaultStyle,
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
          await staticParts(workspace.path, settings.extraContextFiles, true, settings.privacy.allowGit, void 0, void 0, settings);
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
    return modeAnswer(next);
  });
  host.commands.register("auto-enhance.off", async () => setMode(host, "off"));
  host.commands.register("auto-enhance.rules", async () => setMode(host, "rules"));
  host.commands.register("auto-enhance.ai", async () => setMode(host, "ai"));
  host.commands.register("status-bar.toggle", async () => {
    const all = await host.settings.get();
    const next = all.statusBarItem === "hidden" ? "full" : "hidden";
    await host.settings.set("statusBarItem", next);
    await refreshStatusBar(host);
    return WORKER_WORDS.bar[next === "hidden" ? "hidden" : "shown"];
  });
  host.settings.onDidChange(({ key }) => {
    if (key === "autoEnhanceMode" || key === "statusBarItem") void refreshStatusBar(host);
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
  const body = formatText("Enhanced prompt ready ({model}, {seconds} s)", { model, seconds: (ms / 1e3).toFixed(0) });
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
var VERSION = "0.5.0";

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
  "copilot.usage",
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
    const quiet = ["logs.get", "targets.list", "hook.last", "data.summary", "consents.get", "enhance.progress.get"].includes(name);
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
  "statusBarItem": "full",
  "defaultStyle": "balanced",
  "customInstructions": "",
  "contextLevel": "standard",
  "effortLowModel": "auto",
  "effortMediumModel": "auto",
  "effortHighModel": "auto",
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
import { basename as basename3, isAbsolute as isAbsolute3 } from "node:path";
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
    return { id: `copilot::${path}`, path, name: basename3(path) };
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
function createServices(session, directory = process.env.ENHANCE_PROMPT_DATA_DIR || join6(process.env.LOCALAPPDATA || join6(homedir3(), ".local", "share"), "copilot-enhance-prompt"), copilot, options = {}) {
  const data = persistentStore(join6(directory, "data"));
  const prefs = persistentStore(join6(directory, "preferences"));
  const secrets = protectedSecrets(persistentStore(join6(directory, "credentials")));
  const scope = createHash2("sha256").update(session.sessionId).digest("hex").slice(0, 24);
  let migration;
  const prepare = () => migration ??= (async () => {
    await prefs.transaction(async () => {
      for (const key of ["uiLanguage", "outputLanguage"]) if (await prefs.get(key) !== null) await prefs.delete(key);
    });
    await data.transaction(async () => {
      for (const key of await data.keys()) {
        if (key === "uiLocale" || /^(?:session:[a-f0-9]{24}:)?panel:(?:uiLanguage|outputChoice)$/.test(key)) await data.delete(key);
      }
    });
  })().catch((error) => {
    migration = void 0;
    throw error;
  });
  let effortMigration;
  const prepareEfforts = () => effortMigration ??= prefs.transaction(async () => {
    const missing = [];
    for (const key of Object.values(EFFORT_SETTINGS)) if (await prefs.get(key) === null) missing.push(key);
    if (!missing.length) return;
    const saved = parseModelsConfig(await data.get(MODELS_KEY)).profiles;
    const profiles = (saved.length || await prefs.get("allowEnvKeys") === false ? saved : envProfiles()).filter((profile) => profile.enabled);
    const legacy = async (key) => await data.get(`session:${scope}:panel:${key}`) ?? await data.get(`panel:${key}`);
    const choice = await legacy("profileChoice");
    const selected = profiles.find((profile) => profile.id === choice);
    const current = selected ?? profiles[0];
    const override = selected ? await legacy("modelChoice") : null;
    const assignment = current ? modelAssignment(current.id, typeof override === "string" && override ? override : effectiveModel(current)) : "auto";
    for (const key of missing) await prefs.set(key, parseModelAssignment(assignment) ? assignment : "auto");
  }).catch((error) => {
    effortMigration = void 0;
    throw error;
  });
  const adapter = sessionAdapter({ sessionId: session.sessionId, rpc: session.rpc, send: async (options2) => {
    const key = sentKey(session.sessionId, options2.prompt);
    await data.transaction(async () => {
      for (const old of (await data.keys()).filter((key2) => key2.startsWith("sent:"))) {
        if (Number(await data.get(old)) < Date.now()) await data.delete(old);
      }
      await data.set(key, Date.now() + 12e4);
    });
    try {
      return await session.send(options2);
    } catch (error) {
      await data.delete(key);
      throw error;
    }
  } });
  const settings = {
    get: (async (key) => {
      await prepare();
      if (!options.promptHook) await prepareEfforts();
      const values = { ...DEFAULTS };
      for (const name of await prefs.keys()) if (Object.hasOwn(DEFAULTS, name)) values[name] = await prefs.get(name);
      for (const name of UNSUPPORTED_SETTINGS) values[name] = false;
      return key === void 0 ? values : values[key];
    }),
    set: async (key, value) => {
      if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) throw new Error("Invalid setting.");
      if (Object.values(EFFORT_SETTINGS).some((name) => name === key) && !parseModelAssignment(value)) throw new Error("Invalid effort model assignment.");
      if (UNSUPPORTED_SETTINGS.has(key) && value) throw new Error("This setting is unavailable in the Copilot canvas.");
      await prepare();
      await prefs.set(key, value);
    },
    onDidChange: (listener) => prefs.onDidChange(listener)
  };
  const scopeKey = (key) => key.startsWith("panel:") ? `session:${scope}:${key}` : key;
  const storage = {
    get: async (key) => {
      await prepare();
      return data.get(scopeKey(key));
    },
    set: async (key, value) => {
      await prepare();
      await data.set(scopeKey(key), value);
    },
    delete: async (key) => {
      await prepare();
      await data.delete(scopeKey(key));
    },
    keys: async () => {
      await prepare();
      return (await data.keys()).filter((key) => !key.startsWith("session:") || key.startsWith(`session:${scope}:`)).map((key) => key.replace(`session:${scope}:`, ""));
    },
    onDidChange: (listener) => data.onDidChange(({ key }) => {
      if (!key.startsWith("session:") || key.startsWith(`session:${scope}:`)) listener({ key: key.replace(`session:${scope}:`, "") });
    }),
    transaction: async (fn) => {
      await prepare();
      return data.transaction(fn);
    }
  };
  const host = {
    has: (name) => Boolean(copilot) && ["copilot.catalog", "copilot.rewrite"].includes(name) || name === "secrets.protection" || adapter.has(name),
    call: async (name, input, options2) => name === "copilot.catalog" && copilot ? await copilot.catalog() : name === "copilot.rewrite" && copilot ? { text: await copilot.rewrite(input, options2?.signal) } : name === "secrets.protection" ? { status: secrets.available ? "os-keyring" : "unavailable", backend: "DPAPI" } : adapter.call(name, input, options2)
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
  const services = createServices(session, directory, void 0, { promptHook: true });
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
        const project = await services.adapter.project();
        if (project) await staticParts(project.path, settings.extraContextFiles, true, settings.privacy.allowGit, void 0, void 0, settings);
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
