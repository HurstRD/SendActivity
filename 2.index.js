import SelectorSet from 'selector-set';

var bubbleEvents = {};
var captureEvents = {};
var propagationStopped = new WeakMap();
var immediatePropagationStopped = new WeakMap();
var currentTargets = new WeakMap();
var currentTargetDesc = Object.getOwnPropertyDescriptor(Event.prototype, 'currentTarget');

function before(subject, verb, fn) {
  var source = subject[verb];

  subject[verb] = function () {
    fn.apply(subject, arguments);
    return source.apply(subject, arguments);
  };

  return subject;
}

function matches(selectors, target, reverse) {
  var queue = [];
  var node = target;

  do {
    if (node.nodeType !== 1) break;

    var _matches = selectors.matches(node);

    if (_matches.length) {
      var matched = {
        node: node,
        observers: _matches
      };

      if (reverse) {
        queue.unshift(matched);
      } else {
        queue.push(matched);
      }
    }
  } while (node = node.parentElement);

  return queue;
}

function trackPropagation() {
  propagationStopped.set(this, true);
}

function trackImmediate() {
  propagationStopped.set(this, true);
  immediatePropagationStopped.set(this, true);
}

function getCurrentTarget() {
  return currentTargets.get(this) || null;
}

function defineCurrentTarget(event, getter) {
  if (!currentTargetDesc) return;
  Object.defineProperty(event, 'currentTarget', {
    configurable: true,
    enumerable: true,
    get: getter || currentTargetDesc.get
  });
}

function canDispatch(event) {
  try {
    event.eventPhase;
    return true;
  } catch (_) {
    return false;
  }
}

function dispatch(event) {
  if (!canDispatch(event)) return;
  var events = event.eventPhase === 1 ? captureEvents : bubbleEvents;
  var selectors = events[event.type];
  if (!selectors) return;
  var queue = matches(selectors, event.target, event.eventPhase === 1);
  if (!queue.length) return;
  before(event, 'stopPropagation', trackPropagation);
  before(event, 'stopImmediatePropagation', trackImmediate);
  defineCurrentTarget(event, getCurrentTarget);

  for (var i = 0, len1 = queue.length; i < len1; i++) {
    if (propagationStopped.get(event)) break;
    var matched = queue[i];
    currentTargets.set(event, matched.node);

    for (var j = 0, len2 = matched.observers.length; j < len2; j++) {
      if (immediatePropagationStopped.get(event)) break;
      matched.observers[j].data.call(matched.node, event);
    }
  }

  currentTargets["delete"](event);
  defineCurrentTarget(event);
}

function on(name, selector, fn) {
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var capture = options.capture ? true : false;
  var events = capture ? captureEvents : bubbleEvents;
  var selectors = events[name];

  if (!selectors) {
    selectors = new SelectorSet();
    events[name] = selectors;
    document.addEventListener(name, dispatch, capture);
  }

  selectors.add(selector, fn);
}
function off(name, selector, fn) {
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var capture = options.capture ? true : false;
  var events = capture ? captureEvents : bubbleEvents;
  var selectors = events[name];
  if (!selectors) return;
  selectors.remove(selector, fn);
  if (selectors.size) return;
  delete events[name];
  document.removeEventListener(name, dispatch, capture);
}
function fire(target, name, detail) {
  return target.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    cancelable: true,
    detail: detail
  }));
}

export { fire, off, on };
