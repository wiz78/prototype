(function(GLOBAL) {
  let UNDEFINED;
  const SLICE = Array.prototype.slice;

  // Try to reuse the same created element as much as possible. We'll use
  // this DIV for capability checks (where possible) and for normalizing
  // HTML content.
  const DIV = document.createElement( 'div' );

  const INSERTION_TRANSLATIONS = {
    before: function(element, node) {
      element.before(node);
    },
    top: function(element, node) {
      element.insertBefore(node, element.firstChild);
    },
    bottom: function(element, node) {
      element.appendChild(node);
    },
    after: function(element, node) {
      element.after(node);
    },

    tags: {
      TABLE:  ['<table>',                '</table>',                   1],
      TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
      TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
      TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
      SELECT: ['<select>',               '</select>',                  1]
    }
  };

  const ATTRIBUTE_TRANSLATIONS = {};

  /** section: DOM
   * class Element
  **/

  /** section: DOM, related to: Element
   *  $(id) -> Element
   *  $(id...) -> [Element...]
   *    - id (String | Element): A DOM node or a string that references a node's
   *      ID.
   *
   *  If provided with a string, returns the element in the document with
   *  matching ID; otherwise returns the passed element.
   *
   *  Takes in an arbitrary number of arguments. Returns one [[Element]] if
   *  given one argument; otherwise returns an [[Array]] of [[Element]]s.
   *
   *  All elements returned by the function are "extended" with [[Element]]
   *  instance methods.
   *
   *  ##### More Information
   *
   *  The [[$]] function is the cornerstone of Prototype. Not only does it
   *  provide a handy alias for `document.getElementById`, it also lets you pass
   *  indifferently IDs (strings) or DOM node references to your functions:
   *
   *      function foo(element) {
   *          element = $(element);
   *          //  rest of the function...
   *      }
   *
   *  Code written this way is flexible — you can pass it the ID of the element
   *  or the element itself without any type sniffing.
   *
   *  Invoking it with only one argument returns the [[Element]], while invoking it
   *  with multiple arguments returns an [[Array]] of [[Element]]s (and this
   *  works recursively: if you're twisted, you could pass it an array
   *  containing some arrays, and so forth). As this is dependent on
   *  `getElementById`, [W3C specs](http://www.w3.org/TR/DOM-Level-2-Core/core.html#ID-getElBId)
   *  apply: nonexistent IDs will yield `null` and IDs present multiple times in
   *  the DOM will yield erratic results. *If you're assigning the same ID to
   *  multiple elements, you're doing it wrong!*
   *
   *  The function also *extends every returned element* with [[Element.extend]]
   *  so you can use Prototype's DOM extensions on it. In the following code,
   *  the two lines are equivalent. However, the second one feels significantly
   *  more object-oriented:
   *
   *      // Note quite OOP-like...
   *      Element.hide('itemId');
   *      // A cleaner feel, thanks to guaranted extension
   *      $('itemId').hide();
   *
   *  However, when using iterators, leveraging the [[$]] function makes for
   *  more elegant, more concise, and also more efficient code:
   *
   *      ['item1', 'item2', 'item3'].each(Element.hide);
   *      // The better way:
   *      $('item1', 'item2', 'item3').invoke('hide');
   *
   *  See [How Prototype extends the DOM](http://prototypejs.org/learn/extensions)
   *  for more info.
  **/
  function $(element) {
    if (arguments.length > 1) {
      const elements = [];
      const length = arguments.length;
      for (let i = 0; i < length; i++)
        elements.push($(arguments[i]));
      return elements;
    }

    if (Object.isString(element))
      element = document.getElementById(element);
    return element;
  }

  GLOBAL.$ = $;

  // The cache for all our created elements.
  let ELEMENT_CACHE = {};

  // For performance reasons, we create new elements by cloning a "blank"
  // version of a given element. But sometimes this causes problems. Skip
  // the cache if:
  //   (a) We're creating a SELECT element (troublesome in IE6);
  //   (b) We're setting the `type` attribute on an INPUT element
  //       (troublesome in IE9).
  function shouldUseCreationCache(tagName, attributes) {
    if (tagName === 'select') return false;
    return !( 'type' in attributes );
  }

  /**
   *  new Element(tagName[, attributes])
   *  - tagName (String): The name of the HTML element to create.
   *  - attributes (Object): An optional group of attribute/value pairs to set on
   *    the element.
   *
   *  Creates an HTML element with `tagName` as the tag name, optionally with the
   *  given attributes. This can be markedly more concise than working directly
   *  with the DOM methods, and takes advantage of Prototype's workarounds for
   *  various browser issues with certain attributes:
   *
   *  ##### Example
   *
   *      // The old way:
   *      var a = document.createElement('a');
   *      a.setAttribute('class', 'foo');
   *      a.setAttribute('href', '/foo.html');
   *      a.appendChild(document.createTextNode("Next page"));
   *
   *      // The new way:
   *      var a = new Element('a', { 'class': 'foo', href: '/foo.html' }).update("Next page");
   **/
  const oldElement = GLOBAL.Element;

  function Element(tagName, attributes) {
    attributes = attributes || {};
    tagName = tagName.toLowerCase();

    if (!ELEMENT_CACHE[tagName])
      ELEMENT_CACHE[tagName] = document.createElement(tagName);

    const node = shouldUseCreationCache( tagName, attributes ) ?
        ELEMENT_CACHE[ tagName ].cloneNode( false ) : document.createElement( tagName );

    return Element.writeAttribute(node, attributes);
  }

  GLOBAL.Element = Element;

  Object.extend(GLOBAL.Element, oldElement);
  GLOBAL.Element.prototype = oldElement.prototype;

  /**
   *  mixin Element.Methods
   *
   *  [[Element.Methods]] is a mixin for DOM elements. The methods of this object
   *  are accessed through the [[$]] utility or through the [[Element]] object and
   *  shouldn't be accessed directly.
   *
   *  ##### Examples
   *
   *  Hide the element:
   *
   *      $(element).hide();
   *
   *  Return an [[Enumerable]] of all descendant nodes of the element with the id
   *  "articles":
   *
   *      $('articles').descendants();
  **/
  Element.Methods = { ByTag: {}, Simulated: {} };

  // Temporary object for holding all our initial element methods. We'll add
  // them all at once at the bottom of this file.
  let methods = {};

  /**
   *  Element.inspect(@element) -> String
   *
   *  Returns the debug-oriented string representation of `element`.
   *
   *  For more information on `inspect` methods, see [[Object.inspect]].
   *
   *      language: html
   *      <ul>
   *        <li id="golden-delicious">Golden Delicious</li>
   *        <li id="mutsu" class="yummy apple">Mutsu</li>
   *        <li id="mcintosh" class="yummy">McIntosh</li>
   *        <li></li>
   *      </ul>
   *
   *  And the associated JavaScript:
   *
   *      $('golden-delicious').inspect();
   *      // -> '<li id="golden-delicious">'
   *
   *      $('mutsu').inspect();
   *      // -> '<li id="mutsu" class="yummy apple">'
   *
   *      $('mutsu').next().inspect();
   *      // -> '<li>'
   **/
  const INSPECT_ATTRIBUTES = { id: 'id', className: 'class' };

  function inspect(element) {
    element = $(element);
    let result = '<' + element.tagName.toLowerCase();

    let attribute, value;
    for ( let property in INSPECT_ATTRIBUTES) {
      attribute = INSPECT_ATTRIBUTES[property];
      value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    }

    return result + '>';
  }

  methods.inspect = inspect;

  // VISIBILITY

  /**
   *  Element.visible(@element) -> Boolean
   *
   *  Tells whether `element` is visible (i.e., whether its inline `display`
   *  CSS property is set to `none`.
   *
   *  ##### Examples
   *
   *      language: html
   *      <div id="visible"></div>
   *      <div id="hidden" style="display: none;"></div>
   *
   *  And the associated JavaScript:
   *
   *      $('visible').visible();
   *      // -> true
   *
   *      $('hidden').visible();
   *      // -> false
  **/
  function visible(element) {
    return Element.getStyle(element, 'display') !== 'none';
  }

  /**
   *  Element.toggle(@element[, bool]) -> Element
   *  - bool (Boolean): Whether the element should be shown or hidden. If not
   *    a boolean, this argument will be ignored.
   *
   *  Toggles the CSS `display` of `element`. Returns `element`.
   *
   *  Switches an element's CSS `display` between `none` and its inherited
   *  value (usually `block` or `inline`).
   *
   *  By default, `toggle` will switch the display to the opposite of its
   *  current state, but will use the `bool` argument instead if it's
   *  provided (`true` to show the element, `false` to hide it).
   *
   *  If the `bool` argument is not a boolean, **it will be ignored**. This
   *  preserves the ability to toggle elements through comparisons (e.g.,
   *  `errorElement.toggle(errors > 0)`) while also letting a user do
   *  `someElements.each(Element.toggle)` without falling victim to
   *  JavaScript's famous [problems with variadic arguments](http://www.wirfs-brock.com/allen/posts/166).
   *
   *
   *  ##### Examples
   *
   *      <div id="welcome-message">Welcome</div>
   *      <div id="error-message" style="display:none;">Error</div>
   *
   *      $('welcome-message').toggle();
   *      // -> Element (and hides div#welcome-message)
   *
   *      $('error-message').toggle();
   *      // -> Element (and displays div#error-message)
   *
   *      $('error-message').toggle(true);
   *      // -> Element (and displays div#error-message, no matter what its
   *      //    previous state)
   *
   *  Toggle multiple elements using [[Enumerable#each]]:
   *
   *      ['error-message', 'welcome-message'].each(Element.toggle);
   *      // -> ['error-message', 'welcome-message']
   *
   *  Toggle multiple elements using [[Enumerable#invoke]]:
   *
   *      $('error-message', 'welcome-message').invoke('toggle');
   *      // -> [Element, Element]
   *
   *      $('error-message', 'welcome-message').invoke('toggle', false);
   *      // -> [Element, Element] (and hides both elements, no matter what
   *            their previous state)
   *
   *
   *  ##### Notes
   *
   *  [[Element.toggle]] _cannot_ display elements hidden via CSS stylesheets.
   *  Note that this is not a Prototype limitation but a consequence of how the
   *  CSS `display` property works.
   *
   *      <style>
   *        #hidden-by-css {
   *          display: none;
   *        }
   *      </style>
   *
   *      [...]
   *
   *      <div id="hidden-by-css"></div>
   *
   *      $('hidden-by-css').toggle(); // WON'T WORK!
   *      // -> Element (div#hidden-by-css is still hidden!)
  **/
  function toggle(element, bool) {
    element = $(element);
    if (typeof bool !== 'boolean')
      bool = !Element.visible(element);
    Element[bool ? 'show' : 'hide'](element);

    return element;
  }

  /**
   *  Element.hide(@element) -> Element
   *
   *  Sets `display: none` on `element`. Returns `element`.
   *
   *  ##### Examples
   *
   *  Hide a single element:
   *
   *      <div id="error-message"></div>
   *
   *      $('error-message').hide();
   *      // -> Element (and hides div#error-message)
   *
   *  Hide multiple elements using [[Enumerable#each]]:
   *
   *      ['content', 'navigation', 'footer'].each(Element.hide);
   *      // -> ['content', 'navigation', 'footer']
   *
   *  Hide multiple elements using [[Enumerable#invoke]]:
   *
   *      $('content', 'navigation', 'footer').invoke('hide');
   *      // -> [Element, Element, Element]
  **/
  function hide(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  }

  /**
   *  Element.show(@element) -> Element
   *
   *  Removes `display: none` on `element`. Returns `element`.
   *
   *  ##### Examples
   *
   *  Show a single element:
   *
   *      <div id="error-message" style="display:none;"></div>
   *
   *      $('error-message').show();
   *      // -> Element (and displays div#error-message)
   *
   *  Show multiple elements using [[Enumerable#each]]:
   *
   *      ['content', 'navigation', 'footer'].each(Element.show);
   *      // -> ['content', 'navigation', 'footer']
   *
   *  Show multiple elements using [[Enumerable#invoke]]:
   *
   *      $('content', 'navigation', 'footer').invoke('show');
   *      // -> [Element, Element, Element]
   *
   *  ##### Notes
   *
   *  [[Element.show]] _cannot_ display elements hidden via CSS stylesheets.
   *  Note that this is not a Prototype limitation but a consequence of how the
   *  CSS `display` property works.
   *
   *      <style>
   *        #hidden-by-css {
   *          display: none;
   *        }
   *      </style>
   *
   *      [...]
   *
   *      <div id="hidden-by-css"></div>
   *
   *      $('hidden-by-css').show(); // DOES NOT WORK!
   *      // -> Element (div#error-message is still hidden!)
  **/
  function show(element) {
    element = $(element);
    element.style.display = '';
    return element;
  }


  Object.extend(methods, {
    visible: visible,
    toggle:  toggle,
    hide:    hide,
    show:    show
  });

  // MANIPULATION

  /**
   *  Element.remove(@element) -> Element
   *
   *  Completely removes `element` from the document and returns it.
   *
   *  If you would rather just hide the element and keep it around for further
   *  use, try [[Element.hide]] instead.
   *
   *  ##### Examples
   *
   *      language: html
   *      // Before:
   *      <ul>
   *        <li id="golden-delicious">Golden Delicious</li>
   *        <li id="mutsu">Mutsu</li>
   *        <li id="mcintosh">McIntosh</li>
   *        <li id="ida-red">Ida Red</li>
   *      </ul>
   *
   *  And the associated JavaScript:
   *
   *      $('mutsu').remove();
   *      // -> Element (and removes li#mutsu)
   *
   *  The resulting HTML:
   *
   *      language: html
   *      <ul>
   *        <li id="golden-delicious">Golden Delicious</li>
   *        <li id="mcintosh">McIntosh</li>
   *        <li id="ida-red">Ida Red</li>
   *      </ul>
   *
   *  ##### Warning
   *
   *  Using [[Element.remove]] as an instance method (e.g.,
   *  `$('foo').remove('')`) won't work when the element in question is a
   *  `select` element, since`select` elements have [an existing `remove` method](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement)
   *  that behaves differently from this method. As a workaround, use the
   *  generic version instead (`Element.remove('foo')`).
   *
  **/
  function remove(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  }

  // see: http://support.microsoft.com/kb/276228
  const SELECT_ELEMENT_INNERHTML_BUGGY = ( function()
  {
    let el = document.createElement( 'select' ),
        isBuggy = true;
    el.innerHTML = '<option value="test">test</option>';
    if( el.options && el.options[ 0 ] ) {
      isBuggy = el.options[ 0 ].nodeName.toUpperCase() !== 'OPTION';
    }
    el = null;
    return isBuggy;
  } )();

  // see: http://msdn.microsoft.com/en-us/library/ms533897(VS.85).aspx
  const TABLE_ELEMENT_INNERHTML_BUGGY = ( function()
  {
    try {
      let el = document.createElement( 'table' );
      if( el && el.tBodies ) {
        el.innerHTML = '<tbody><tr><td>test</td></tr></tbody>';
        const isBuggy = typeof el.tBodies[ 0 ] == 'undefined';
        el = null;
        return isBuggy;
      }
    }
    catch( e ) {
      return true;
    }
  } )();

  const ANY_INNERHTML_BUGGY = SELECT_ELEMENT_INNERHTML_BUGGY ||
      TABLE_ELEMENT_INNERHTML_BUGGY;

  /**
   *  Element.update(@element[, newContent]) -> Element
   *
   *  Replaces _the content_ of `element` with the `newContent` argument and
   *  returns `element`.
   *
   *  `newContent` may be in any of these forms:
   *  - [[String]]: A string of HTML to be parsed and rendered
   *  - [[Element]]: An Element instance to insert
   *  - ...any object with a `toElement` method: The method is called and the resulting element used
   *  - ...any object with a `toHTML` method: The method is called and the resulting HTML string
   *    is parsed and rendered
   *
   *  If `newContent` is omitted, the element's content is blanked out (i.e.,
   *  replaced with an empty string).
   *
   *  If `newContent` is a string and contains one or more inline `<script>`
   *  tags, the scripts are scheduled to be evaluated after a very brief pause
   *  (using [[Function#defer]]) to allow the browser to finish updating the
   *  DOM. Note that the scripts are evaluated in the scope of
   *  [[String#evalScripts]], not in the global scope, which has important
   *  ramifications for your `var`s and `function`s.
   *  See [[String#evalScripts]] for details.
   *
   *  Note that this method allows seamless content update of table related
   *  elements in Internet Explorer and beyond.
   *
   *  Any nodes replaced with `Element.update` will first have event
   *  listeners unregistered and storage keys removed. This frees up memory
   *  and prevents leaks in certain versions of Internet Explorer. (See
   *  [[Element.purge]]).
   *
   *  ##### Examples
   *
   *      language: html
   *      <div id="fruits">carrot, eggplant and cucumber</div>
   *
   *  Passing a regular string:
   *
   *      $('fruits').update('kiwi, banana and apple');
   *      // -> Element
   *      $('fruits').innerHTML;
   *      // -> 'kiwi, banana and apple'
   *
   *  Clearing the element's content:
   *
   *      $('fruits').update();
   *      // -> Element
   *      $('fruits').innerHTML;
   *      // -> '' (an empty string)
   *
   *  And now inserting an HTML snippet:
   *
   *      $('fruits').update('<p>Kiwi, banana <em>and</em> apple.</p>');
   *      // -> Element
   *      $('fruits').innerHTML;
   *      // -> '<p>Kiwi, banana <em>and</em> apple.</p>'
   *
   *  ... with a `<script>` tag thrown in:
   *
   *      $('fruits').update('<p>Kiwi, banana <em>and</em> apple.</p><script>alert("updated!")</script>');
   *      // -> Element (and prints "updated!" in an alert dialog).
   *      $('fruits').innerHTML;
   *      // -> '<p>Kiwi, banana <em>and</em> apple.</p>'
   *
   *  Relying on the `toString()` method:
   *
   *      $('fruits').update(123);
   *      // -> Element
   *      $('fruits').innerHTML;
   *      // -> '123'
   *
   *  Finally, you can do some pretty funky stuff by defining your own
   *  `toString()` method on your custom objects:
   *
   *      var Fruit = Class.create({
   *        initialize: function(fruit){
   *          this.fruit = fruit;
   *        },
   *        toString: function(){
   *          return 'I am a fruit and my name is "' + this.fruit + '".';
   *        }
   *      });
   *      var apple = new Fruit('apple');
   *
   *      $('fruits').update(apple);
   *      $('fruits').innerHTML;
   *      // -> 'I am a fruit and my name is "apple".'
  **/
  function update(element, content) {
    element = $(element);

    // Purge the element's existing contents of all storage keys and
    // event listeners, since said content will be replaced no matter
    // what.
    element.querySelectorAll( '*' ).forEach(purgeElement);

    if (content && content.toElement)
      content = content.toElement();

    if (Object.isElement(content))
      return element.update().insert(content);

    content = Object.toHTML(content);
    const tagName = element.tagName.toUpperCase();

    if (ANY_INNERHTML_BUGGY) {
      if (tagName in INSERTION_TRANSLATIONS.tags) {
        while (element.firstChild)
          element.removeChild(element.firstChild);

        const nodes = getContentFromAnonymousElement( tagName, content.stripScripts() );

        nodes.forEach(node => element.appendChild(node));

      } else {
        element.innerHTML = content.stripScripts();
      }
    } else {
      element.innerHTML = content.stripScripts();
    }

    content.evalScripts.bind(content).defer();
    return element;
  }

  /**
   *  Element.replace(@element[, newContent]) -> Element
   *
   *  Replaces `element` _itself_ with `newContent` and returns `element`.
   *
   *  Keep in mind that this method returns the element that has just been
   *  removed &mdash; not the element that took its place.
   *
   *  `newContent` can be either plain text, an HTML snippet or any JavaScript
   *  object which has a `toString()` method.
   *
   *  If `newContent` contains any `<script>` tags, these will be evaluated
   *  after `element` has been replaced ([[Element.replace]] internally calls
   *  [[String#evalScripts]]).
   *
   *  Note that if no argument is provided, [[Element.replace]] will simply
   *  clear `element` of its content. However, using [[Element.remove]] to do so
   *  is both faster and more standard compliant.
   *
   *  ##### Examples
   *
   *      language: html
   *      <div id="food">
   *        <div id="fruits">
   *          <p id="first">Kiwi, banana <em>and</em> apple.</p>
   *        </div>
   *      </div>
   *
   *  Passing an HTML snippet:
   *
   *      $('first').replace('<ul id="favorite"><li>kiwi</li><li>banana</li><li>apple</li></ul>');
   *      // -> Element (p#first)
   *
   *      $('fruits').innerHTML;
   *      // -> '<ul id="favorite"><li>kiwi</li><li>banana</li><li>apple</li></ul>'
   *
   *  Again, with a `<script>` tag thrown in:
   *
   *      $('favorite').replace('<p id="still-first">Melon, oranges <em>and</em> grapes.</p><script>alert("removed!")</script>');
   *      // -> Element (ul#favorite) and prints "removed!" in an alert dialog.
   *
   *      $('fruits').innerHTML;
   *      // -> '<p id="still-first">Melon, oranges <em>and</em> grapes.</p>'
   *
   *  With plain text:
   *
   *      $('still-first').replace('Melon, oranges and grapes.');
   *      // -> Element (p#still-first)
   *
   *      $('fruits').innerHTML;
   *      // -> 'Melon, oranges and grapes.'
   *
   *  Finally, relying on the `toString()` method:
   *
   *      $('fruits').replace(123);
   *      // -> Element
   *
   *      $('food').innerHTML;
   *      // -> '123'
   *
   *  ##### Warning
   *
   *  Using [[Element.replace]] as an instance method (e.g.,
   *  `$('foo').replace('<p>Bar</p>')`) causes errors in Opera 9 when used on
   *  `input` elements. The `replace` property is reserved on `input` elements
   *  as part of [Web Forms 2](http://www.whatwg.org/specs/web-forms/current-work/).
   *  As a workaround, use the generic version instead
   *  (`Element.replace('foo', '<p>Bar</p>')`).
   *
  **/
  function replace(element, content) {
    element = $(element);

    if (content && content.toElement) {
      content = content.toElement();
    } else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      const range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }

    element.replaceWith(content);
    return element;
  }

  const tags = INSERTION_TRANSLATIONS.tags;

  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });

  function isContent(content) {
    if (Object.isUndefined(content) || content === null) return false;

    if (Object.isString(content) || Object.isNumber(content)) return true;
    if (Object.isElement(content)) return true;

    return !!( content.toElement || content.toHTML );
  }

  // This private method does the bulk of the work for Element#insert. The
  // actual insert method handles argument normalization and multiple
  // content insertions.
  function insertContentAt(element, content, position) {
    position   = position.toLowerCase();
    const method = INSERTION_TRANSLATIONS[ position ];

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      method(element, content);
      return element;
    }

    content = Object.toHTML(content);
    const tagName = ( ( position === 'before' || position === 'after' ) ?
        element.parentNode : element ).tagName.toUpperCase();

    const childNodes = getContentFromAnonymousElement( tagName, content.stripScripts() );

    if (position === 'top' || position === 'after') childNodes.reverse();

    childNodes.forEach(node => method(element, node));

    content.evalScripts.bind(content).defer();
  }

  /**
   *  Element.insert(@element, content) -> Element
   *  - content (String | Element | Object): The content to insert.
   *
   *  Inserts content `above`, `below`, at the `top`, and/or at the `bottom` of
   *  the given element, depending on the option(s) given.
   *
   *  `insert` accepts content in any of these forms:
   *  - [[String]]: A string of HTML to be parsed and rendered
   *  - [[Element]]: An Element instance to insert
   *  - ...any object with a `toElement` method: The method is called and the resulting element used
   *  - ...any object with a `toHTML` method: The method is called and the resulting HTML string
   *    is parsed and rendered
   *
   *  The `content` argument can be the content to insert, in which case the
   *  implied insertion point is `bottom`, or an object that specifies one or
   *  more insertion points (e.g., `{ bottom: "foo", top: "bar" }`).
   *
   *  Accepted insertion points are:
   *  - `before` (as `element`'s previous sibling)
   *  - `after` (as `element's` next sibling)
   *  - `top` (as `element`'s first child)
   *  - `bottom` (as `element`'s last child)
   *
   *  Note that if the inserted HTML contains any `<script>` tag, these will be
   *  automatically evaluated after the insertion (`insert` internally calls
   *  [[String.evalScripts]] when inserting HTML).
   *
   *  <h5>Examples</h5>
   *
   *  Insert the given HTML at the bottom of the element (using the default):
   *
   *      $('myelement').insert("<p>HTML to append</p>");
   *
   *      $('myelement').insert({
   *        top: new Element('img', {src: 'logo.png'})
   *      });
   *
   *  Put `hr`s `before` and `after` the element:
   *
   *      $('myelement').insert({
   *        before: "<hr>",
   *        after: "<hr>"
   *      });
  **/
  function insert(element, insertions) {
    element = $(element);

    if (isContent(insertions))
      insertions = { bottom: insertions };

    for ( let position in insertions)
      insertContentAt(element, insertions[position], position);

    return element;
  }

  /**
   *  Element.wrap(@element, wrapper[, attributes]) -> Element
   *  - wrapper (Element | String): An element to wrap `element` inside, or
   *    else a string representing the tag name of an element to be created.
   *  - attributes (Object): A set of attributes to apply to the wrapper
   *    element. Refer to the [[Element]] constructor for usage.
   *
   *  Wraps an element inside another, then returns the wrapper.
   *
   *  If the given element exists on the page, [[Element.wrap]] will wrap it in
   *  place — its position will remain the same.
   *
   *  The `wrapper` argument can be _either_ an existing [[Element]] _or_ a
   *  string representing the tag name of an element to be created. The optional
   *  `attributes` argument can contain a list of attribute/value pairs that
   *  will be set on the wrapper using [[Element.writeAttribute]].
   *
   *  ##### Examples
   *
   *  Original HTML:
   *
   *      language: html
   *      <table id="data">
   *        <tr>
   *          <th>Foo</th>
   *          <th>Bar</th>
   *        </tr>
   *        <tr>
   *          <td>1</td>
   *          <td>2</td>
   *        </tr>
   *      </table>
   *
   *  JavaScript:
   *
   *      // approach 1:
   *      var div = new Element('div', { 'class': 'table-wrapper' });
   *      $('data').wrap(div);
   *
   *      // approach 2:
   *      $('data').wrap('div', { 'class': 'table-wrapper' });
   *
   *      // Both examples are equivalent &mdash; they return the DIV.
   *
   *  Resulting HTML:
   *
   *      language: html
   *      <div class="table-wrapper">
   *        <table id="data">
   *          <tr>
   *            <th>Foo</th>
   *            <th>Bar</th>
   *          </tr>
   *          <tr>
   *            <td>1</td>
   *            <td>2</td>
   *          </tr>
   *        </table>
   *      </div>
   *
   *  ##### Warning
   *
   *  Using [[Element.wrap]] as an instance method (e.g., `$('foo').wrap('p')`)
   *  causes errors in Internet Explorer when used on `textarea` elements. The
   *  `wrap` property is reserved on `textarea`'s as a proprietary extension to
   *  HTML. As a workaround, use the generic version instead
   *  (`Element.wrap('foo', 'p')`).
  **/
  function wrap(element, wrapper, attributes) {
    element = $(element);

    if (Object.isElement(wrapper)) {
      // The wrapper argument is a DOM node.
      $(wrapper).writeAttribute(attributes || {});
    } else if (Object.isString(wrapper)) {
      // The wrapper argument is a string representing a tag name.
      wrapper = new Element(wrapper, attributes);
    } else {
      // No wrapper was specified, which means the second argument is a set
      // of attributes.
      wrapper = new Element('div', wrapper);
    }

    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);

    wrapper.appendChild(element);

    return wrapper;
  }

  /**
   *  Element.cleanWhitespace(@element) -> Element
   *
   *  Removes all of `element`'s child text nodes that contain *only*
   *  whitespace. Returns `element`.
   *
   *  This can be very useful when using standard properties like `nextSibling`,
   *  `previousSibling`, `firstChild` or `lastChild` to walk the DOM. Usually
   *  you'd only do that if you are interested in all of the DOM nodes, not
   *  just Elements (since if you just need to traverse the Elements in the
   *  DOM tree, you can use [[Element.up]], [[Element.down]],
   *  [[Element.next]], and [[Element.previous]] instead).
   *
   *  #### Example
   *
   *  Consider the following HTML snippet:
   *
   *      language: html
   *      <ul id="apples">
   *        <li>Mutsu</li>
   *        <li>McIntosh</li>
   *        <li>Ida Red</li>
   *      </ul>
   *
   *  Let's grab what we think is the first list item using the raw DOM
   *  method:
   *
   *      var element = $('apples');
   *      element.firstChild.innerHTML;
   *      // -> undefined
   *
   *  It's undefined because the `firstChild` of the `apples` element is a
   *  text node containing the whitespace after the end of the `ul` and before
   *  the first `li`.
   *
   *  If we remove the useless whitespace, then `firstChild` works as expected:
   *
   *      var element = $('apples');
   *      element.cleanWhitespace();
   *      element.firstChild.innerHTML;
   *      // -> 'Mutsu'
  **/
  function cleanWhitespace(element) {
    element = $(element);
    let node = element.firstChild;

    while (node) {
      const nextNode = node.nextSibling;
      if (node.nodeType === Node.TEXT_NODE && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  }

  /**
   *  Element.empty(@element) -> Element
   *
   *  Tests whether `element` is empty (i.e., contains only whitespace).
   *
   *  ##### Examples
   *
   *      <div id="wallet">     </div>
   *      <div id="cart">full!</div>
   *
   *      $('wallet').empty();
   *      // -> true
   *
   *      $('cart').empty();
   *      // -> false
  **/
  function empty(element) {
    return $(element).innerHTML.blank();
  }

  // In older versions of Internet Explorer, certain elements don't like
  // having innerHTML set on them — including SELECT and most table-related
  // tags. So we wrap the string with enclosing HTML (if necessary), stick it
  // in a DIV, then grab the DOM nodes.
  function getContentFromAnonymousElement(tagName, html, force) {
    let t = INSERTION_TRANSLATIONS.tags[ tagName ], div = DIV;

    let workaround = !!t;
    if (!workaround && force) {
      workaround = true;
      t = ['', '', 0];
    }

    if (workaround) {
      div.innerHTML = '&#160;' + t[0] + html + t[1];
      div.removeChild(div.firstChild);
      for ( let i = t[2]; i--; )
        div = div.firstChild;
    } else {
      div.innerHTML = html;
    }

    return Array.from(div.childNodes);
  }

  /**
   *  Element.clone(@element, deep) -> Element
   *  - deep (Boolean): Whether to clone `element`'s descendants as well.
   *
   *  Returns a duplicate of `element`.
   *
   *  A wrapper around DOM Level 2 `Node#cloneNode`, [[Element.clone]] cleans up
   *  any expando properties defined by Prototype.
   *
   *  ##### Example
   *
   *      <div class="original">
   *        <div class="original_child"></div>
   *      </div>
   *
   *      var clone = $('original').clone();
   *      clone.className;
   *      // -> "original"
   *      clone.childElements();
   *      // -> []
   *
   *      var deepClone = $('original').clone(true);
   *      deepClone.className;
   *      // -> "original"
   *      deepClone.childElements();
   *      // -> [div.original_child]
  **/
  function clone(element, deep) {
    if (!(element = $(element))) return;
    const clone = element.cloneNode( deep );
    clone._prototypeUID = UNDEFINED;
    if (deep) {
      const descendants = Element.select( clone, '*' );
      let i = descendants.length;
      while (i--)
        descendants[i]._prototypeUID = UNDEFINED;
    }
    return clone;
  }

  // Performs cleanup on a single element before it is removed from the page.
  function purgeElement(element) {
    const uid = getUniqueElementID( element );
    if (uid) {
      Element.stopObserving(element);
      element._prototypeUID = UNDEFINED;
      delete Element.Storage[uid];
    }
  }


  /**
   *  Element.purge(@element) -> null
   *
   *  Removes all event listeners and storage keys from an element.
   *
   *  To be used just before removing an element from the page.
  **/
  function purge(element) {
    if (!(element = $(element))) return;
    purgeElement(element);

    const descendants = element.getElementsByTagName( '*' );
    let i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }

  Object.extend(methods, {
    remove:  remove,
    update:  update,
    replace: replace,
    insert:  insert,
    wrap:    wrap,
    cleanWhitespace: cleanWhitespace,
    empty:   empty,
    clone:   clone,
    purge:   purge
  });


  // TRAVERSAL

  /**
   *  Element.recursivelyCollect(@element, property) -> [Element...]
   *
   *  Recursively collects elements whose relationship to `element` is
   *  specified by `property`. `property` has to be a _property_ (a method
   *  won't do!) of `element` that points to a single DOM node (e.g.,
   *  `nextSibling` or `parentNode`).
   *
   *  ##### More information
   *
   *  This method is used internally by [[Element.ancestors]],
   *  [[Element.descendants]], [[Element.nextSiblings]],
   *  [[Element.previousSiblings]] and [[Element.siblings]] which offer really
   *  convenient way to grab elements, so directly accessing
   *  [[Element.recursivelyCollect]] should seldom be needed. However, if you
   *  are after something out of the ordinary, it is the way to go.
   *
   *  Note that all of Prototype's DOM traversal methods ignore text nodes and
   *  return element nodes only.
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul id="fruits">
   *        <li id="apples">
   *          <ul id="list-of-apples">
   *            <li id="golden-delicious"><p>Golden Delicious</p></li>
   *            <li id="mutsu">Mutsu</li>
   *            <li id="mcintosh">McIntosh</li>
   *            <li id="ida-red">Ida Red</li>
   *          </ul>
   *        </li>
   *      </ul>
   *
   *  And the associated JavaScript:
   *
   *      $('fruits').recursivelyCollect('firstChild');
   *      // -> [li#apples, ul#list-of-apples, li#golden-delicious, p]
  **/
  function recursivelyCollect(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    const elements = [];

    while (element = element[property]) {
      if (element.nodeType === Node.ELEMENT_NODE)
        elements.push(element);

      if (elements.length === maximumLength) break;
    }

    return elements;
  }


  /**
   *  Element.ancestors(@element) -> [Element...]
   *
   *  Collects all of `element`'s ancestor elements and returns them as an
   *  array of extended elements.
   *
   *  The returned array's first element is `element`'s direct ancestor (its
   *  `parentNode`), the second one is its grandparent, and so on until the
   *  `<html>` element is reached. `<html>` will always be the last member of
   *  the array. Calling `ancestors` on the `<html>` element will return an
   *  empty array.
   *
   *  ##### Example
   *
   *  Assuming:
   *
   *      language: html
   *      <html>
   *      [...]
   *        <body>
   *          <div id="father">
   *            <div id="kid">
   *            </div>
   *          </div>
   *        </body>
   *      </html>
   *
   *  Then:
   *
   *      $('kid').ancestors();
   *      // -> [div#father, body, html]
  **/
  function ancestors(element) {
    return recursivelyCollect(element, 'parentNode');
  }

  /**
   *  Element.descendants(@element) -> [Element...]
   *
   *  Collects all of the element's descendants (its children, their children,
   *  etc.) and returns them as an array of extended elements. As with all of
   *  Prototype's DOM traversal methods, only [[Element]]s are returned, other
   *  nodes (text nodes, etc.) are skipped.
  **/
  function descendants(element) {
    return Element.select(element, '*');
  }

  /**
   *  Element.firstDescendant(@element) -> Element
   *
   *  Returns the first child that is an element.
   *
   *  This is opposed to the `firstChild` DOM property, which will return
   *  any node, including text nodes and comment nodes.
   *
   *  ##### Examples
   *
   *      language: html
   *      <div id="australopithecus">
   *        <div id="homo-erectus"><!-- Latin is super -->
   *          <div id="homo-neanderthalensis"></div>
   *          <div id="homo-sapiens"></div>
   *        </div>
   *      </div>
   *
   *  Then:
   *
   *      $('australopithecus').firstDescendant();
   *      // -> div#homo-erectus
   *
   *      // the DOM property returns any first node
   *      $('homo-erectus').firstChild;
   *      // -> comment node "Latin is super"
   *
   *      // this is what we want!
   *      $('homo-erectus').firstDescendant();
   *      // -> div#homo-neanderthalensis
  **/
  function firstDescendant(element) {
    element = $(element).firstChild;
    while (element && element.nodeType !== Node.ELEMENT_NODE)
      element = element.nextSibling;

    return $(element);
  }

  /** deprecated, alias of: Element.childElements
   *  Element.immediateDescendants(@element) -> [Element...]
   *
   *  **This method is deprecated, please see [[Element.childElements]]**.
  **/
  function immediateDescendants(element) {
    const results = [];
    let child = $( element ).firstChild;

    while (child) {
      if (child.nodeType === Node.ELEMENT_NODE)
        results.push(child);

      child = child.nextSibling;
    }

    return results;
  }

  /**
   *  Element.previousSiblings(@element) -> [Element...]
   *
   *  Collects all of `element`'s previous siblings and returns them as an
   *  [[Array]] of elements.
   *
   *  Two elements are siblings if they have the same parent. So for example,
   *  the `<head>` and `<body>` elements are siblings (their parent is the
   *  `<html>` element). Previous-siblings are simply the ones which precede
   *  `element` in the document.
   *
   *  The returned [[Array]] reflects the siblings _inversed_ order in the
   *  document (e.g. an index of 0 refers to the lowest sibling i.e., the one
   *  closest to `element`).
   *
   *  Note that all of Prototype's DOM traversal methods ignore text nodes and
   *  return element nodes only.
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul>
   *        <li id="golden-delicious">Golden Delicious</li>
   *        <li id="mutsu">Mutsu</li>
   *        <li id="mcintosh">McIntosh</li>
   *        <li id="ida-red">Ida Red</li>
   *      </ul>
   *
   *  Then:
   *
   *      $('mcintosh').previousSiblings();
   *      // -> [li#mutsu, li#golden-delicious]
   *
   *      $('golden-delicious').previousSiblings();
   *      // -> []
  **/
  function previousSiblings(element) {
    return recursivelyCollect(element, 'previousSibling');
  }

  /**
   *  Element.nextSiblings(@element) -> [Element...]
   *
   *  Collects all of `element`'s next siblings and returns them as an [[Array]]
   *  of elements.
   *
   *  Two elements are siblings if they have the same parent. So for example,
   *  the `head` and `body` elements are siblings (their parent is the `html`
   *  element). Next-siblings are simply the ones which follow `element` in the
   *  document.
   *
   *  The returned [[Array]] reflects the siblings order in the document
   *  (e.g. an index of 0 refers to the sibling right below `element`).
   *
   *  Note that all of Prototype's DOM traversal methods ignore text nodes and
   *  return element nodes only.
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul>
   *        <li id="golden-delicious">Golden Delicious</li>
   *        <li id="mutsu">Mutsu</li>
   *        <li id="mcintosh">McIntosh</li>
   *        <li id="ida-red">Ida Red</li>
   *      </ul>
   *
   *  Then:
   *
   *      $('mutsu').nextSiblings();
   *      // -> [li#mcintosh, li#ida-red]
   *
   *      $('ida-red').nextSiblings();
   *      // -> []
  **/
  function nextSiblings(element) {
    return recursivelyCollect(element, 'nextSibling');
  }

  /**
   *  Element.siblings(@element) -> [Element...]
   *
   *  Collects all of element's siblings and returns them as an [[Array]] of
   *  elements.
   *
   *  Two elements are siblings if they have the same parent. So for example,
   *  the `head` and `body` elements are siblings (their parent is the `html`
   *  element).
   *
   *  The returned [[Array]] reflects the siblings' order in the document (e.g.
   *  an index of 0 refers to `element`'s topmost sibling).
   *
   *  Note that all of Prototype's DOM traversal methods ignore text nodes and
   *  return element nodes only.
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul>
   *        <li id="golden-delicious">Golden Delicious</li>
   *        <li id="mutsu">Mutsu</li>
   *        <li id="mcintosh">McIntosh</li>
   *        <li id="ida-red">Ida Red</li>
   *      </ul>
   *
   *  Then:
   *
   *      $('mutsu').siblings();
   *      // -> [li#golden-delicious, li#mcintosh, li#ida-red]
  **/
  function siblings(element) {
    element = $(element);
    const previous = previousSiblings( element ),
        next = nextSiblings( element );
    return previous.reverse().concat(next);
  }

  /**
   *  Element.match(@element, selector) -> boolean
   *  - selector (String): A CSS selector.
   *
   *  Checks if `element` matches the given CSS selector.
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul id="fruits">
   *        <li id="apples">
   *          <ul>
   *            <li id="golden-delicious">Golden Delicious</li>
   *            <li id="mutsu" class="yummy">Mutsu</li>
   *            <li id="mcintosh" class="yummy">McIntosh</li>
   *            <li id="ida-red">Ida Red</li>
   *          </ul>
   *        </li>
   *      </ul>
   *
   *  Then:
   *
   *      $('fruits').match('ul');
   *      // -> true
   *
   *      $('mcintosh').match('li#mcintosh.yummy');
   *      // -> true
   *
   *      $('fruits').match('p');
   *      // -> false
  **/
  function match(element, selector) {
    element = $(element);

    // If selector is a string, we assume it's a CSS selector.
    if (Object.isString(selector))
      return element.matches(selector);

    // Otherwise, we assume it's an object with its own `match` method.
    return selector.match(element);
  }


  // Internal method for optimizing traversal. Works like
  // `recursivelyCollect`, except it stops at the first match and doesn't
  // extend any elements except for the returned element.
  function _recursivelyFind(element, property, expression, index) {
    element = $(element), expression = expression || 0, index = index || 0;
    if (Object.isNumber(expression)) {
      index = expression, expression = null;
    }

    while (element = element[property]) {
      // Skip any non-element nodes.
      if (element.nodeType !== 1) continue;
      // Skip any nodes that don't match the expression, if there is one.
      if (expression && !element.matches(expression))
        continue;
      // Skip the first `index` matches we find.
      if (--index >= 0) continue;

      return element;
    }
  }


  /**
   *  Element.up(@element[, expression[, index = 0]]) -> Element
   *  Element.up(@element[, index = 0]) -> Element
   *  - expression (String): A CSS selector.
   *
   *  Returns `element`'s first ancestor (or the Nth ancestor, if `index`
   *  is specified) that matches `expression`. If no `expression` is
   *  provided, all ancestors are considered. If no ancestor matches these
   *  criteria, `undefined` is returned.
   *
   *  ##### More information
   *
   *  The [[Element.up]] method is part of Prototype's ultimate DOM traversal
   *  toolkit (check out [[Element.down]], [[Element.next]] and
   *  [[Element.previous]] for some more Prototypish niceness). It allows
   *  precise index-based and/or CSS rule-based selection of any of `element`'s
   *  **ancestors**.
   *
   *  As it totally ignores text nodes (it only returns elements), you don't
   *  have to worry about whitespace nodes.
   *
   *  And as an added bonus, all elements returned are already extended
   *  (see [[Element.extended]]) allowing chaining:
   *
   *      $(element).up(1).next('li', 2).hide();
   *
   *  Walking the DOM has never been that easy!
   *
   *  ##### Arguments
   *
   *  If no arguments are passed, `element`'s first ancestor is returned (this
   *  is similar to calling `parentNode` except [[Element.up]] returns an already
   *  extended element.
   *
   *  If `index` is defined, `element`'s corresponding ancestor is returned.
   *  (This is equivalent to selecting an element from the array of elements
   *  returned by the method [[Element.ancestors]]). Note that the first element
   *  has an index of 0.
   *
   *  If `expression` is defined, [[Element.up]] will return the first ancestor
   *  that matches it.
   *
   *  If both `expression` and `index` are defined, [[Element.up]] will collect
   *  all the ancestors matching the given CSS expression and will return the
   *  one at the specified index.
   *
   *  **In all of the above cases, if no descendant is found,** `undefined`
   *  **will be returned.**
   *
   *  ### Examples
   *
   *      language: html
   *      <html>
   *        [...]
   *        <body>
   *          <ul id="fruits">
   *            <li id="apples" class="keeps-the-doctor-away">
   *              <ul>
   *                <li id="golden-delicious">Golden Delicious</li>
   *                <li id="mutsu" class="yummy">Mutsu</li>
   *                <li id="mcintosh" class="yummy">McIntosh</li>
   *                <li id="ida-red">Ida Red</li>
   *              </ul>
   *            </li>
   *          </ul>
   *        </body>
   *      </html>
   *
   *  Get the first ancestor of "#fruites":
   *
   *      $('fruits').up();
   *      // or:
   *      $('fruits').up(0);
   *      // -> body
   *
   *  Get the third ancestor of "#mutsu":
   *
   *      $('mutsu').up(2);
   *      // -> ul#fruits
   *
   *  Get the first ancestor of "#mutsu" with the node name "li":
   *
   *      $('mutsu').up('li');
   *      // -> li#apples
   *
   *  Get the first ancestor of "#mutsu" with the class name
   *  "keeps-the-doctor-away":
   *
   *      $('mutsu').up('.keeps-the-doctor-away');
   *      // -> li#apples
   *
   *  Get the second ancestor of "#mutsu" with the node name "ul":
   *
   *      $('mutsu').up('ul', 1);
   *      // -> ul#fruits
   *
   *  Try to get the first ancestor of "#mutsu" with the node name "div":
   *
   *      $('mutsu').up('div');
   *      // -> undefined
  **/
  function up(element, expression, index) {
    element = $(element);

    if (arguments.length === 1) return element.parentNode;
    return _recursivelyFind(element, 'parentNode', expression, index);
  }

  /**
   *  Element.down(@element[, expression[, index = 0]]) -> Element
   *  Element.down(@element[, index = 0]) -> Element
   *  - expression (String): A CSS selector.
   *
   *  Returns `element`'s first descendant (or the Nth descendant, if `index`
   *  is specified) that matches `expression`. If no `expression` is
   *  provided, all descendants are considered. If no descendant matches these
   *  criteria, `undefined` is returned.
   *
   *  ##### More information
   *
   *  The [[Element.down]] method is part of Prototype's ultimate DOM traversal
   *  toolkit (check out [[Element.up]], [[Element.next]] and
   *  [[Element.previous]] for some more Prototypish niceness). It allows
   *  precise index-based and/or CSS rule-based selection of any of the
   *  element's **descendants**.
   *
   *  As it totally ignores text nodes (it only returns elements), you don't
   *  have to worry about whitespace nodes.
   *
   *  And as an added bonus, all elements returned are already extended
   *  (see [[Element.extend]]) allowing chaining:
   *
   *      $(element).down(1).next('li', 2).hide();
   *
   *  Walking the DOM has never been that easy!
   *
   *  ##### Arguments
   *
   *  If no arguments are passed, `element`'s first descendant is returned (this
   *  is similar to calling `firstChild` except [[Element.down]] returns an
   *  extended element.
   *
   *  If `index` is defined, `element`'s corresponding descendant is returned.
   *  (This is equivalent to selecting an element from the array of elements
   *  returned by the method [[Element.descendants]].) Note that the first
   *  element has an index of 0.
   *
   *  If `expression` is defined, [[Element.down]] will return the first
   *  descendant that matches it. This is a great way to grab the first item in
   *  a list for example (just pass in 'li' as the method's first argument).
   *
   *  If both `expression` and `index` are defined, [[Element.down]] will collect
   *  all the descendants matching the given CSS expression and will return the
   *  one at the specified index.
   *
   *  **In all of the above cases, if no descendant is found,** `undefined`
   *  **will be returned.**
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul id="fruits">
   *        <li id="apples">
   *          <ul>
   *            <li id="golden-delicious">Golden Delicious</li>
   *            <li id="mutsu" class="yummy">Mutsu</li>
   *            <li id="mcintosh" class="yummy">McIntosh</li>
   *            <li id="ida-red">Ida Red</li>
   *          </ul>
   *        </li>
   *      </ul>
   *
   *  Get the first descendant of "#fruites":
   *
   *      $('fruits').down();
   *      // or:
   *      $('fruits').down(0);
   *      // -> li#apples
   *
   *  Get the third descendant of "#fruits":
   *
   *      $('fruits').down(3);
   *      // -> li#golden-delicious
   *
   *  Get the first descendant of "#apples" with the node name "li":
   *
   *      $('apples').down('li');
   *      // -> li#golden-delicious
   *
   *  Get the first descendant of "#apples" with the node name "li" and the
   *  class name "yummy":
   *
   *      $('apples').down('li.yummy');
   *      // -> li#mutsu
   *
   *  Get the second descendant of "#fruits" with the class name "yummy":
   *
   *      $('fruits').down('.yummy', 1);
   *      // -> li#mcintosh
   *
   *  Try to get the ninety-ninth descendant of "#fruits":
   *
   *      $('fruits').down(99);
   *      // -> undefined
  **/
  function down(element, expression, index) {
    if (arguments.length === 1) return firstDescendant(element);
    element = $(element);
    expression = expression || 0;
    index = index || 0;

    if (Object.isNumber(expression)) {
      index = expression;
      expression = '*';
    }

    return element.querySelectorAll(expression)[index];
  }

  /**
   *  Element.previous(@element[, expression[, index = 0]]) -> Element
   *  Element.previous(@element[, index = 0]) -> Element
   *  - expression (String): A CSS selector.
   *
   *  Returns `element`'s first previous sibling (or the Nth, if `index`
   *  is specified) that matches `expression`. If no `expression` is
   *  provided, all previous siblings are considered. If none matches these
   *  criteria, `undefined` is returned.
   *
   *  ##### More information
   *
   *  The [[Element.previous]] method is part of Prototype's ultimate DOM
   *  traversal toolkit (check out [[Element.up]], [[Element.down]] and
   *  [[Element.next]] for some more Prototypish niceness). It allows precise
   *  index-based and/or CSS expression-based selection of any of `element`'s
   *  **previous siblings**. (Note that two elements are considered siblings if
   *  they have the same parent, so for example, the `head` and `body` elements
   *  are siblings&#8212;their parent is the `html` element.)
   *
   *  As it totally ignores text nodes (it only returns elements), you don't
   *  have to worry about whitespace nodes.
   *
   *  And as an added bonus, all elements returned are already extended (see
   *  [[Element.extend]]) allowing chaining:
   *
   *      $(element).down('p').previous('ul', 2).hide();
   *
   *  Walking the DOM has never been that easy!
   *
   *  ##### Arguments
   *
   *  If no arguments are passed, `element`'s previous sibling is returned
   *  (this is similar as calling `previousSibling` except [[Element.previous]]
   *  returns an already extended element).
   *
   *  If `index` is defined, `element`'s corresponding previous sibling is
   *  returned. (This is equivalent to selecting an element from the array of
   *  elements returned by the method [[Element.previousSiblings]]). Note that
   *  the sibling _right above_ `element` has an index of 0.
   *
   *  If `expression` is defined, [[Element.previous]] will return the `element`
   *  first previous sibling that matches it.
   *
   *  If both `expression` and `index` are defined, [[Element.previous]] will
   *  collect all of `element`'s previous siblings matching the given CSS
   *  expression and will return the one at the specified index.
   *
   *  **In all of the above cases, if no previous sibling is found,**
   *  `undefined` **will be returned.**
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul id="fruits">
   *        <li id="apples">
   *          <h3>Apples</h3>
   *          <ul id="list-of-apples">
   *            <li id="golden-delicious" class="yummy">Golden Delicious</li>
   *            <li id="mutsu" class="yummy">Mutsu</li>
   *            <li id="mcintosh">McIntosh</li>
   *            <li id="ida-red">Ida Red</li>
   *          </ul>
   *          <p id="saying">An apple a day keeps the doctor away.</p>
   *        </li>
   *      </ul>
   *
   *  Get the first previous sibling of "#saying":
   *
   *      $('saying').previous();
   *      // or:
   *      $('saying').previous(0);
   *      // -> ul#list-of-apples
   *
   *  Get the second previous sibling of "#saying":
   *
   *      $('saying').previous(1);
   *      // -> h3
   *
   *  Get the first previous sibling of "#saying" with node name "h3":
   *
   *      $('saying').previous('h3');
   *      // -> h3
   *
   *  Get the first previous sibling of "#ida-red" with class name "yummy":
   *
   *      $('ida-red').previous('.yummy');
   *      // -> li#mutsu
   *
   *  Get the second previous sibling of "#ida-red" with class name "yummy":
   *
   *      $('ida-red').previous('.yummy', 1);
   *      // -> li#golden-delicious
   *
   *  Try to get the sixth previous sibling of "#ida-red":
   *
   *      $('ida-red').previous(5);
   *      // -> undefined
  **/
  function previous(element, expression, index) {
    return _recursivelyFind(element, 'previousSibling', expression, index);
  }

  /**
   *  Element.next(@element[, expression[, index = 0]]) -> Element
   *  Element.next(@element[, index = 0]) -> Element
   *  - expression (String): A CSS selector.
   *
   *  Returns `element`'s first following sibling (or the Nth, if `index`
   *  is specified) that matches `expression`. If no `expression` is
   *  provided, all following siblings are considered. If none matches these
   *  criteria, `undefined` is returned.
   *
   *  ##### More information
   *
   *  The [[Element.next]] method is part of Prototype's ultimate DOM traversal
   *  toolkit (check out [[Element.up]], [[Element.down]] and
   *  [[Element.previous]] for some more Prototypish niceness). It allows
   *  precise index-based and/or CSS expression-based selection of any of
   *  `element`'s **following siblings**. (Note that two elements are considered
   *  siblings if they have the same parent, so for example, the `head` and
   *  `body` elements are siblings&#8212;their parent is the `html` element.)
   *
   *  As it totally ignores text nodes (it only returns elements), you don't
   *  have to worry about whitespace nodes.
   *
   *  And as an added bonus, all elements returned are already extended (see
   *  [[Element.extend]]) allowing chaining:
   *
   *      $(element).down(1).next('li', 2).hide();
   *
   *  Walking the DOM has never been that easy!
   *
   *  ##### Arguments
   *
   *  If no arguments are passed, `element`'s following sibling is returned
   *  (this is similar as calling `nextSibling` except [[Element.next]] returns an
   *  already extended element).
   *
   *  If `index` is defined, `element`'s corresponding following sibling is
   *  returned. (This is equivalent to selecting an element from the array of
   *  elements returned by the method [[Element.nextSiblings]]). Note that the
   *  sibling _right below_ `element` has an index of 0.
   *
   *  If `expression` is defined, [[Element.next]] will return the `element` first
   *  following sibling that matches it.
   *
   *  If both `expression` and `index` are defined, [[Element.next]] will collect
   *  all of `element`'s following siblings matching the given CSS expression
   *  and will return the one at the specified index.
   *
   *  **In all of the above cases, if no following sibling is found,**
   *  `undefined` **will be returned.**
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul id="fruits">
   *        <li id="apples">
   *          <h3 id="title">Apples</h3>
   *          <ul id="list-of-apples">
   *            <li id="golden-delicious">Golden Delicious</li>
   *            <li id="mutsu">Mutsu</li>
   *            <li id="mcintosh" class="yummy">McIntosh</li>
   *            <li id="ida-red" class="yummy">Ida Red</li>
   *          </ul>
   *          <p id="saying">An apple a day keeps the doctor away.</p>
   *        </li>
   *      </ul>
   *
   *  Get the first sibling after "#title":
   *
   *      $('title').next();
   *      // or:
   *      $('title').next(0);
   *      // -> ul#list-of-apples
   *
   *  Get the second sibling after "#title":
   *
   *      $('title').next(1);
   *      // -> p#saying
   *
   *  Get the first sibling after "#title" with node name "p":
   *
   *      $('title').next('p');
   *      // -> p#sayings
   *
   *  Get the first sibling after "#golden-delicious" with class name "yummy":
   *
   *      $('golden-delicious').next('.yummy');
   *      // -> li#mcintosh
   *
   *  Get the second sibling after "#golden-delicious" with class name "yummy":
   *
   *      $('golden-delicious').next('.yummy', 1);
   *      // -> li#ida-red
   *
   *  Try to get the first sibling after "#ida-red":
   *
   *      $('ida-red').next();
   *      // -> undefined
  **/
  function next(element, expression, index) {
    return _recursivelyFind(element, 'nextSibling', expression, index);
  }

  /**
   *  Element.select(@element, expression...) -> [Element...]
   *  - expression (String): A CSS selector.
   *
   *  Takes an arbitrary number of CSS selectors and returns an array of
   *  descendants of `element` that match any of them.
   *
   *  This method is very similar to [[$$]] but can be used within the context
   *  of one element, rather than the whole document. The supported CSS syntax
   *  is identical, so please refer to the [[$$]] docs for details.
   *
   *  ##### Examples
   *
   *      language: html
   *      <ul id="fruits">
   *        <li id="apples">
   *          <h3 title="yummy!">Apples</h3>
   *          <ul id="list-of-apples">
   *            <li id="golden-delicious" title="yummy!" >Golden Delicious</li>
   *            <li id="mutsu" title="yummy!">Mutsu</li>
   *            <li id="mcintosh">McIntosh</li>
   *            <li id="ida-red">Ida Red</li>
   *          </ul>
   *          <p id="saying">An apple a day keeps the doctor away.</p>
   *        </li>
   *      </ul>
   *
   *  Then:
   *
   *      $('apples').select('[title="yummy!"]');
   *      // -> [h3, li#golden-delicious, li#mutsu]
   *
   *      $('apples').select( 'p#saying', 'li[title="yummy!"]');
   *      // -> [li#golden-delicious, li#mutsu,  p#saying]
   *
   *      $('apples').select('[title="disgusting!"]');
   *      // -> []
   *
   *  ##### Tip
   *
   *  [[Element.select]] can be used as a pleasant alternative to the native
   *  method `getElementsByTagName`:
   *
   *      var nodes  = $A(someUL.getElementsByTagName('li')).map(Element.extend);
   *      var nodes2 = someUL.select('li');
   *
   *  In the first example, you must explicitly convert the result set to an
   *  [[Array]] (so that Prototype's [[Enumerable]] methods can be used) and
   *  must manually call [[Element.extend]] on each node (so that custom
   *  instance methods can be used on the nodes). [[Element.select]] takes care
   *  of both concerns on its own.
   *
   *  If you're using 1.6 or above (and the performance optimizations therein),
   *  the speed difference between these two examples is negligible.
  **/
  function select(element) {
    element = $(element);
    const expressions = SLICE.call( arguments, 1 ).join( ', ' );
    return Array.from(element.querySelectorAll(expressions));
  }

  /**
   *  Element.adjacent(@element, selector...) -> [Element...]
   *  - selector (String): A CSS selector.
   *
   *  Finds all siblings of the current element that match the given
   *  selector(s). If you provide multiple selectors, siblings matching *any*
   *  of the selectors are included. If a sibling matches multiple selectors,
   *  it is only included once. The order of the returned array is not defined.
   *
   *  ##### Example
   *
   *  Assuming this list:
   *
   *      language: html
   *      <ul id="cities">
   *        <li class="us" id="nyc">New York</li>
   *        <li class="uk" id="lon">London</li>
   *        <li class="us" id="chi">Chicago</li>
   *        <li class="jp" id="tok">Tokyo</li>
   *        <li class="us" id="la">Los Angeles</li>
   *        <li class="us" id="aus">Austin</li>
   *      </ul>
   *
   *  Then:
   *
   *      $('nyc').adjacent('li.us');
   *      // -> [li#chi, li#la, li#aus]
   *      $('nyc').adjacent('li.uk', 'li.jp');
   *      // -> [li#lon, li#tok]
  **/
  function adjacent(element) {
    element = $(element);
    const expressions = SLICE.call( arguments, 1 ).join( ', ' );
    const siblings = Element.siblings( element );

    return siblings.filter(sibling => sibling.matches(expressions));
  }

  /**
   *  Element.descendantOf(@element, ancestor) -> Boolean
   *  - ancestor (Element | String): The element to check against (or its ID).
   *
   *  Checks if `element` is a descendant of `ancestor`.
   *
   *  ##### Example
   *
   *  Assuming:
   *
   *      language: html
   *      <div id="australopithecus">
   *        <div id="homo-erectus">
   *          <div id="homo-sapiens"></div>
   *        </div>
   *      </div>
   *
   *  Then:
   *
   *      $('homo-sapiens').descendantOf('australopithecus');
   *      // -> true
   *
   *      $('homo-erectus').descendantOf('homo-sapiens');
   *      // -> false
  **/
  function descendantOf(element, ancestor) {
    element = $(element), ancestor = $(ancestor);
    if (!element || !ancestor) return false;
    return (element.compareDocumentPosition(ancestor) & 8) === 8;
  }

  Object.extend(methods, {
    recursivelyCollect:   recursivelyCollect,
    ancestors:            ancestors,
    descendants:          descendants,
    firstDescendant:      firstDescendant,
    immediateDescendants: immediateDescendants,
    previousSiblings:     previousSiblings,
    nextSiblings:         nextSiblings,
    siblings:             siblings,
    match:                match,
    up:                   up,
    down:                 down,
    previous:             previous,
    next:                 next,
    select:               select,
    adjacent:             adjacent,
    descendantOf:         descendantOf,

    // ALIASES
    /** alias of: Element.select
     *  Element.getElementsBySelector(@element, selector) -> [Element...]
    **/
    getElementsBySelector: select,

    /**
     *  Element.childElements(@element) -> [Element...]
     *
     *  Collects all of the element's children and returns them as an array of
     *  [[Element.extended extended]] elements, in document order. The first
     *  entry in the array is the topmost child of `element`, the next is the
     *  child after that, etc.
     *
     *  Like all of Prototype's DOM traversal methods, [[Element.childElements]]
     *  ignores text nodes and returns element nodes only.
     *
     *  ##### Example
     *
     *  Assuming:
     *
     *      language: html
     *      <div id="australopithecus">
     *        Some text in a text node
     *        <div id="homo-erectus">
     *          <div id="homo-neanderthalensis"></div>
     *          <div id="homo-sapiens"></div>
     *        </div>
     *      </div>
     *
     *  Then:
     *
     *      $('australopithecus').childElements();
     *      // -> [div#homo-erectus]
     *
     *      $('homo-erectus').childElements();
     *      // -> [div#homo-neanderthalensis, div#homo-sapiens]
     *
     *      $('homo-sapiens').childElements();
     *      // -> []
    **/
    childElements:         immediateDescendants
  });


  // ATTRIBUTES
  /**
   *  Element.identify(@element) -> String
   *
   *  Returns `element`'s ID. If `element` does not have an ID, one is
   *  generated, assigned to `element`, and returned.
   *
   *  ##### Examples
   *
   *  Original HTML:
   *
   *        <ul>
   *          <li id="apple">apple</li>
   *          <li>orange</li>
   *        </ul>
   *
   *  JavaScript:
   *
   *        $('apple').identify();
   *        // -> 'apple'
   *
   *        $('apple').next().identify();
   *        // -> 'anonymous_element_1'
   *
   *  Resulting HTML:
   *
   *        <ul>
   *          <li id="apple">apple</li>
   *          <li id="anonymous_element_1">orange</li>
   *        </ul>
   **/
  let idCounter = 1;

  function identify(element) {
    element = $(element);
    let id = Element.readAttribute( element, 'id' );
    if (id) return id;

    // The element doesn't have an ID of its own. Give it one, first ensuring
    // that it's unique.
    do { id = 'anonymous_element_' + idCounter++ } while ($(id));

    Element.writeAttribute(element, 'id', id);
    return id;
  }


  /**
   *  Element.readAttribute(@element, attributeName) -> String | null
   *
   *  Returns the value of `element`'s `attribute` or `null` if `attribute` has
   *  not been specified.
   *
   *  This method acts as a simple wrapper around `getAttribute`.
   *
   *  ##### Examples
   *
   *      language: html
   *      <a id="tag" href="/tags/prototype" rel="tag" title="view related bookmarks." my_widget="some info.">Prototype</a>
   *
   *  Then:
   *
   *      $('tag').readAttribute('href');
   *      // -> '/tags/prototype'
   *
   *      $('tag').readAttribute('title');
   *      // -> 'view related bookmarks.'
   *
   *      $('tag').readAttribute('my_widget');
   *      // -> 'some info.'
  **/
  function readAttribute(element, name) {
    return $(element).getAttribute(name);
  }

  /**
   *  Element.writeAttribute(@element, attribute[, value = true]) -> Element
   *  Element.writeAttribute(@element, attributes) -> Element
   *
   *  Adds, specifies or removes attributes passed as either a hash or a
   *  name/value pair.
  **/
  function writeAttribute(element, name, value) {
    element = $(element);
    let attributes = {};
    const table = ATTRIBUTE_TRANSLATIONS.write;

    if (typeof name === 'object') {
      attributes = name;
    } else {
      attributes[name] = Object.isUndefined(value) ? true : value;
    }

    for ( let attr in attributes) {
      name = table.names[attr] || attr;
      value = attributes[attr];
      if (table.values[attr]) {
        // The value needs to be handled a certain way. Either the handler
        // function will transform the value (in which case it'll return the
        // new value) or it'll handle the attribute setting a different way
        // altogether, in which case it won't return anything. In the latter
        // case, we can skip the actual call to `setAttribute`.
        value = table.values[attr](element, value);
        if (Object.isUndefined(value)) continue;
      }
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }

    return element;
  }

  function hasAttribute(element, attribute) {
    attribute = ATTRIBUTE_TRANSLATIONS.has[attribute] || attribute;
    const node = $( element ).getAttributeNode( attribute );
    return !!(node && node.specified);
  }

  GLOBAL.Element.Methods.Simulated.hasAttribute = hasAttribute;

  /**
   *  Element.hasClassName(@element, className) -> Boolean
   *
   *  Checks for the presence of CSS class `className` on `element`.
   *
   *  ##### Examples
   *
   *      language: html
   *      <div id="mutsu" class="apple fruit food"></div>
   *
   *  Then:
   *
   *      $('mutsu').hasClassName('fruit');
   *      // -> true
   *
   *      $('mutsu').hasClassName('vegetable');
   *      // -> false
  **/
  function hasClassName(element, className) {
    element = $(element);

    return element && element.classList.contains(className);
  }

  /**
   *  Element.addClassName(@element, className) -> Element
   *  - className (String): The class name to add.
   *
   *  Adds the given CSS class to `element`.
   *
   *  ##### Example
   *
   *  Assuming this HTML:
   *
   *      language: html
   *      <div id="mutsu" class="apple fruit"></div>
   *
   *  Then:
   *
   *      $('mutsu').className;
   *      // -> 'apple fruit'
   *      $('mutsu').addClassName('food');
   *      $('mutsu').className;
   *      // -> 'apple fruit food'
  **/
  function addClassName(element, className) {
    element = $(element);

    if(element)
      element.classList.add(className);

    return element;
  }

  /**
   *  Element.removeClassName(@element, className) -> Element
   *
   *  Removes CSS class `className` from `element`.
   *
   *  ##### Examples
   *
   *  Assuming this HTML:
   *
   *      language: html
   *      <div id="mutsu" class="apple fruit food"></div>
   *
   *  Then:
   *
   *      $('mutsu').removeClassName('food');
   *      // -> Element
   *
   *      $('mutsu').className;
   *      // -> 'apple fruit'
  **/
  function removeClassName(element, className) {
    element = $(element);

    if(element)
      element.classList.remove(className);

    return element;
  }

  /**
   *  Element.toggleClassName(@element, className[, bool]) -> Element
   *
   *  Toggles the presence of CSS class `className` on `element`.
   *
   *  By default, `toggleClassName` will flip to the opposite state, but
   *  will use `bool` instead if it's given; `true` will add the class name
   *  and `false` will remove it.
   *
   *  ##### Examples
   *
   *      language: html
   *      <div id="mutsu" class="apple"></div>
   *
   *  Then:
   *
   *      $('mutsu').hasClassName('fruit');
   *      // -> false
   *
   *      $('mutsu').toggleClassName('fruit');
   *      // -> Element
   *
   *      $('mutsu').hasClassName('fruit');
   *      // -> true
   *
   *      $('mutsu').toggleClassName('fruit', true);
   *      // -> Element (keeps the "fruit" class name that was already there)
  **/
  function toggleClassName(element, className, bool) {
    element = $(element);

    if(element)
      element.classList.toggle(className,bool);

    return element;
  }

  /**
   *  Element.classNames(@element) -> [String...]
   *
   *  Returns an array of classnames.
  **/
  function classNames(element) {
    return Array.from(element.classList);
  }

  // Test attributes.
  const classProp = 'class';
  let forProp = 'for';

  let LABEL = document.createElement( 'label' );
  LABEL.setAttribute(forProp, 'x');
  if (LABEL.htmlFor !== 'x') {
    LABEL.setAttribute('htmlFor', 'x');
    if (LABEL.htmlFor === 'x')
      forProp = 'htmlFor';
  }
  LABEL = null;

  function _getAttr(element, attribute) {
    return element.getAttribute(attribute);
  }

  function _getAttr2(element, attribute) {
    return element.getAttribute(attribute, 2);
  }

  function _getAttrNode(element, attribute) {
    const node = element.getAttributeNode( attribute );
    return node ? node.value : '';
  }

  function _getFlag(element, attribute) {
    return $(element).hasAttribute(attribute) ? attribute : null;
  }

  // Test whether attributes like `onclick` have their values serialized.
  DIV.onclick = Prototype.emptyFunction;
  const onclickValue = DIV.getAttribute( 'onclick' );

  let _getEv;

  // IE >=8
  if (onclickValue === '') {
    // only function body is serialized
    _getEv = function(element, attribute) {
      const value = element.getAttribute( attribute );
      if (!value) return null;
      return value.trim();
    };
  }

  ATTRIBUTE_TRANSLATIONS.read = {
    names: {
      'class':     classProp,
      'className': classProp,
      'for':       forProp,
      'htmlFor':   forProp
    },

    values: {
      style: function(element) {
        return element.style.cssText.toLowerCase();
      },
      title: function(element) {
        return element.title;
      }
    }
  };

  ATTRIBUTE_TRANSLATIONS.write = {
    names: {
      className:   'class',
      htmlFor:     'for',
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    },

    values: {
      checked: function(element, value) {
        value = !!value;
        element.checked = value;
        // Return the string that should be written out as its actual
        // attribute. If we're unchecking, return `null` so that
        // `writeAttribute` knows to remove the `checked` attribute
        // altogether.
        return value ? 'checked' : null;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  ATTRIBUTE_TRANSLATIONS.has = { names: {} };

  Object.extend(ATTRIBUTE_TRANSLATIONS.write.names, ATTRIBUTE_TRANSLATIONS.read.names);

  const CAMEL_CASED_ATTRIBUTE_NAMES = $w( 'colSpan rowSpan vAlign dateTime ' +
      'accessKey tabIndex encType maxLength readOnly longDesc frameBorder' );

  CAMEL_CASED_ATTRIBUTE_NAMES.forEach(attr => {
    const key = attr.toLowerCase();
    ATTRIBUTE_TRANSLATIONS.write.names[key] = attr;
    ATTRIBUTE_TRANSLATIONS.has.names[key]   = attr;
  });

  // The rest of the oddballs.
  Object.extend(ATTRIBUTE_TRANSLATIONS.read.values, {
    href:        _getAttr2,
    src:         _getAttr2,
    type:        _getAttr,
    action:      _getAttrNode,
    disabled:    _getFlag,
    checked:     _getFlag,
    readonly:    _getFlag,
    multiple:    _getFlag,
    onload:      _getEv,
    onunload:    _getEv,
    onclick:     _getEv,
    ondblclick:  _getEv,
    onmousedown: _getEv,
    onmouseup:   _getEv,
    onmouseover: _getEv,
    onmousemove: _getEv,
    onmouseout:  _getEv,
    onfocus:     _getEv,
    onblur:      _getEv,
    onkeypress:  _getEv,
    onkeydown:   _getEv,
    onkeyup:     _getEv,
    onsubmit:    _getEv,
    onreset:     _getEv,
    onselect:    _getEv,
    onchange:    _getEv
  });


  Object.extend(methods, {
    identify:        identify,
    readAttribute:   readAttribute,
    writeAttribute:  writeAttribute,
    hasClassName:    hasClassName,
    addClassName:    addClassName,
    removeClassName: removeClassName,
    toggleClassName: toggleClassName,
    classNames:      classNames
  });


  // STYLES
  function normalizeStyleName(style) {
    return style.camelize();
  }

  /**
   *  Element.setStyle(@element, styles) -> Element
   *
   *  Modifies `element`'s CSS style properties. Styles are passed as a hash of
   *  property-value pairs in which the properties are specified in their
   *  camelized form.
   *
   *  ##### Examples
   *
   *      $(element).setStyle({
   *        backgroundColor: '#900',
   *        fontSize: '12px'
   *      });
   *      // -> Element
   *
   *  ##### Notes
   *
   *  The method transparently deals with browser inconsistencies for `float`
   *  (however, as `float` is a reserved keyword, you must either escape it or
   *  use `cssFloat` instead) and `opacity` (which accepts values between `0`
   *  -fully transparent- and `1` -fully opaque-). You can safely use either of
   *  the following across all browsers:
   *
   *      $(element).setStyle({
   *        cssFloat: 'left',
   *        opacity: 0.5
   *      });
   *      // -> Element
   *
   *      $(element).setStyle({
   *        'float': 'left', // notice how float is surrounded by single quotes
   *        opacity: 0.5
   *      });
   *      // -> Element
   *
   *  Not all CSS shorthand properties are supported. You may only use the CSS
   *  properties described in the
   *  [Document Object Model (DOM) Level 2 Style Specification](http://www.w3.org/TR/DOM-Level-2-Style/css.html#CSS-ElementCSSInlineStyle).
  **/
  function setStyle(element, styles) {
    element = $(element);
    const elementStyle = element.style;

    if (Object.isString(styles)) {
      // Set the element's CSS text directly.
      elementStyle.cssText += ';' + styles;
      if (styles.include('opacity')) {
        const opacity = styles.match( /opacity:\s*(\d?\.?\d*)/ )[ 1 ];
        Element.setOpacity(element, opacity);
      }
      return element;
    }

    for (let property in styles) {
      const value = styles[ property ];
      if (property === 'opacity') {
        Element.setOpacity(element, value);
      } else {
        if (property === 'cssFloat') {
          property = 'float';
        }
        elementStyle[property] = value;
      }
    }

    return element;
  }


  /**
   *  Element.getStyle(@element, style) -> String | Number | null
   *  - style (String): The property name to be retrieved.
   *
   *  Returns the given CSS property value of `element`. The property can be
   *  specified in either its CSS form (`font-size`) or its camelized form
   *  (`fontSize`).
   *
   *  This method looks up the CSS property of an element whether it was
   *  applied inline or in a stylesheet. It works around browser inconsistencies
   *  regarding `float`, `opacity`, which returns a value between `0`
   *  (fully transparent) and `1` (fully opaque), position properties
   *  (`left`, `top`, `right` and `bottom`) and when getting the dimensions
   *  (`width` or `height`) of hidden elements.
   *
   *  If a value is present, it will be returned as a string &mdash; except
   *  for `opacity`, which returns a number between `0` and `1` just as
   *  [[Element.getOpacity]] does.
   *
   *  ##### Examples
   *
   *      $(element).getStyle('font-size');
   *      // equivalent:
   *
   *      $(element).getStyle('fontSize');
   *      // -> '12px'
   *
   *  ##### Notes
   *
   *  Not all CSS shorthand properties are supported. You may only use the CSS
   *  properties described in the
   *  [Document Object Model (DOM) Level 2 Style Specification](http://www.w3.org/TR/DOM-Level-2-Style/css.html#CSS-ElementCSSInlineStyle).
   *
   *  Consider the following HTML snippet:
   *
   *      language: html
   *      <style>
   *        #test {
   *          font-size: 12px;
   *          margin-left: 1em;
   *        }
   *      </style>
   *      <div id="test"></div>
   *
   *  Then:
   *
   *      $('test').getStyle('margin-left');
   *      // -> '12px'
   *
  **/
  function getStyle(element, style) {
    element = $(element);
    style = normalizeStyleName(style);
    const doc = element.ownerDocument;

    // Try inline styles first.
    let value = element.style[ style ];
    if (!value || value === 'auto') {
      // Reluctantly retrieve the computed style.
      const css = doc.defaultView.getComputedStyle( element, null );
      value = css ? css[style] : null;
    }

    if (style === 'opacity') return value ? parseFloat(value) : 1.0;
    return value === 'auto' ? null : value;
  }

  /**
   *  Element.setOpacity(@element, opacity) -> [Element...]
   *
   *  Sets the visual opacity of an element while working around inconsistencies
   *  in various browsers. The `opacity` argument should be a floating point
   *  number, where the value of `0` is fully transparent and `1` is fully opaque.
   *
   *  [[Element.setStyle]] method uses [[Element.setOpacity]] internally when needed.
   *
   *  ##### Examples
   *
   *      var element = $('myelement');
   *      // set to 50% transparency
   *      element.setOpacity(0.5);
   *
   *      // these are equivalent, but allow for setting more than
   *      // one CSS property at once:
   *      element.setStyle({ opacity: 0.5 });
   *      element.setStyle("opacity: 0.5");
  **/
  function setOpacity(element, value) {
    element = $(element);
    if (value == 1 || value === '') value = '';
    else if (value < 0.00001) value = 0;
    element.style.opacity = value;
    return element;
  }


  /**
   *  Element.getOpacity(@element) -> Number | null
   *
   *  Returns the opacity of the element.
  **/
  function getOpacity(element) {
    return Element.getStyle(element, 'opacity');
  }


  Object.extend(methods, {
    setStyle:   setStyle,
    getStyle:   getStyle,
    setOpacity: setOpacity,
    getOpacity: getOpacity
  });

  // STORAGE
  GLOBAL.Element.Storage = { UID: 1 };

  function getUniqueElementID(element) {
    if (element === window) return 0;

    // Need to use actual `typeof` operator to prevent errors in some
    // environments when accessing node expandos.
    if (typeof element._prototypeUID === 'undefined')
      element._prototypeUID = Element.Storage.UID++;
    return element._prototypeUID;
  }

  /**
   *  Element.getStorage(@element) -> Hash
   *
   *  Returns the [[Hash]] object that stores custom metadata for this element.
  **/
  function getStorage(element) {
    if (!(element = $(element))) return;

    const uid = getUniqueElementID( element );

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  }

  /**
   *  Element.store(@element, key, value) -> Element
   *  Element.store(@element, object) -> Element
   *
   *  Stores a key/value pair of custom metadata on the element. If it is
   *  given one argument instead of two, it treats that argument as an object
   *  of key/value pairs, and stores _each_ pair as element metadata.
   *
   *  The metadata can later be retrieved with [[Element.retrieve]].
  **/
  function store(element, key, value) {
    if (!(element = $(element))) return;
    const storage = getStorage( element );
    if (arguments.length === 2) {
      // Assume we've been passed an object full of key/value pairs.
      storage.update(key);
    } else {
      storage.set(key, value);
    }
    return element;
  }

  /**
   *  Element.retrieve(@element, key[, defaultValue]) -> ?
   *
   *  Retrieves custom metadata set on `element` with [[Element.store]].
   *
   *  If the value is `undefined` and `defaultValue` is given, it will be
   *  stored on the element as its new value for that key, then returned.
  **/
  function retrieve(element, key, defaultValue) {
    if (!(element = $(element))) return;
    const storage = getStorage( element );
    let value = storage.get( key );

    if (Object.isUndefined(value)) {
      storage.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  }

  Object.extend(methods, {
    getStorage: getStorage,
    store:      store,
    retrieve:   retrieve
  });


  // ELEMENT EXTENSION
  const ByTag = Element.Methods.ByTag;

  /**
   *  Element.extend(element) -> Element
   *
   *  Extends the given element instance with all of the Prototype goodness and
   *  syntactic sugar, as well as any extensions added via [[Element.addMethods]].
   *  (If the element instance was already extended, this is a no-op.)
   *
   *  You only need to use [[Element.extend]] on element instances you've acquired
   *  directly from the DOM; **all** Prototype methods that return element
   *  instances (such as [[$]], [[Element.down]], etc.) will pre-extend the
   *  element before returning it.
   *
   *  Check out ["How Prototype extends the
   *  DOM"](http://prototypejs.org/learn/extensions) for more about element
   *  extensions.
   *
   *  ##### Details
   *
   *  Specifically, [[Element.extend]] extends the given instance with the methods
   *  contained in [[Element.Methods]] and `Element.Methods.Simulated`. If `element`
   *  is an `input`, `textarea`, or `select` element, it will also be extended
   *  with the methods from `Form.Element.Methods`. If it is a `form` element, it
   *  will also be extended with the methods from `Form.Methods`.
   **/
  const extend = Prototype.K;

  function addMethodsToTagName(tagName, methods) {
    tagName = tagName.toUpperCase();
    if (!ByTag[tagName]) ByTag[tagName] = {};
    Object.extend(ByTag[tagName], methods);
  }

  function mergeMethods(destination, methods, onlyIfAbsent) {
    if (Object.isUndefined(onlyIfAbsent)) onlyIfAbsent = false;
    for ( let property in methods) {
      const value = methods[ property ];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    let klass;
    const trans = {
      'OPTGROUP': 'OptGroup', 'TEXTAREA': 'TextArea', 'P': 'Paragraph',
      'FIELDSET': 'FieldSet', 'UL': 'UList', 'OL': 'OList', 'DL': 'DList',
      'DIR': 'Directory', 'H1': 'Heading', 'H2': 'Heading', 'H3': 'Heading',
      'H4': 'Heading', 'H5': 'Heading', 'H6': 'Heading', 'Q': 'Quote',
      'INS': 'Mod', 'DEL': 'Mod', 'A': 'Anchor', 'IMG': 'Image', 'CAPTION':
          'TableCaption', 'COL': 'TableCol', 'COLGROUP': 'TableCol', 'THEAD':
          'TableSection', 'TFOOT': 'TableSection', 'TBODY': 'TableSection', 'TR':
          'TableRow', 'TH': 'TableCell', 'TD': 'TableCell', 'FRAMESET':
          'FrameSet', 'IFRAME': 'IFrame'
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    let element = document.createElement( tagName );
    const proto = element[ '__proto__' ] || element.constructor.prototype;

    element = null;
    return proto;
  }

  /**
   *  Element.addMethods(methods) -> undefined
   *  Element.addMethods(tagName, methods) -> undefined
   *  - tagName (String): (Optional) The name of the HTML tag for which the
   *    methods should be available; if not given, all HTML elements will have
   *    the new methods.
   *  - methods (Object): A hash of methods to add.
   *
   *  [[Element.addMethods]] makes it possible to mix your *own* methods into the
   *  [[Element]] object and extended element instances (all of them, or only ones
   *  with the given HTML tag if you specify `tagName`).
   *
   *  You define the methods in a hash that you provide to [[Element.addMethods]].
   *  Here's an example adding two methods:
   *
   *      Element.addMethods({
   *
   *        // myOwnMethod: Do something cool with the element
   *        myOwnMethod: function(element) {
   *          if (!(element = $(element))) return;
   *          // ...do smething with 'element'...
   *          return element;
   *        },
   *
   *        // wrap: Wrap the element in a new element using the given tag
   *        wrap: function(element, tagName) {
   *          var wrapper;
   *          if (!(element = $(element))) return;
   *          wrapper = new Element(tagName);
   *          element.parentNode.replaceChild(wrapper, element);
   *          wrapper.appendChild(element);
   *          return wrapper;
   *        }
   *
   *      });
   *
   *  Once added, those can be used either via [[Element]]:
   *
   *      // Wrap the element with the ID 'foo' in a div
   *      Element.wrap('foo', 'div');
   *
   *  ...or as instance methods of extended elements:
   *
   *      // Wrap the element with the ID 'foo' in a div
   *      $('foo').wrap('div');
   *
   *  Note the following requirements and conventions for methods added to
   *  [[Element]]:
   *
   *  - The first argument is *always* an element or ID, by convention this
   *    argument is called `element`.
   *  - The method passes the `element` argument through [[$]] and typically
   *    returns if the result is undefined.
   *  - Barring a good reason to return something else, the method returns the
   *    extended element to enable chaining.
   *
   *  Our `myOwnMethod` method above returns the element because it doesn't have
   *  a good reason to return anything else. Our `wrap` method returns the
   *  wrapper, because that makes more sense for that method.
   *
   *  ##### Extending only specific elements
   *
   *  If you call [[Element.addMethods]] with *two* arguments, it will apply the
   *  methods only to elements with the given HTML tag:
   *
   *      Element.addMethods('DIV', my_div_methods);
   *      // the given methods are now available on DIV elements, but not others
   *
   *  You can also pass an *[[Array]]* of tag names as the first argument:
   *
   *      Element.addMethods(['DIV', 'SPAN'], my_additional_methods);
   *      // DIV and SPAN now both have the given methods
   *
   *  (Tag names in the first argument are not case sensitive.)
   *
   *  Note: [[Element.addMethods]] has built-in security which prevents you from
   *  overriding native element methods or properties (like `getAttribute` or
   *  `innerHTML`), but nothing prevents you from overriding one of Prototype's
   *  methods. Prototype uses a lot of its methods internally; overriding its
   *  methods is best avoided or at least done only with great care.
   *
   *  ##### Example 1
   *
   *  Our `wrap` method earlier was a complete example. For instance, given this
   *  paragraph:
   *
   *      language: html
   *      <p id="first">Some content...</p>
   *
   *  ...we might wrap it in a `div`:
   *
   *      $('first').wrap('div');
   *
   *  ...or perhaps wrap it and apply some style to the `div` as well:
   *
   *      $('first').wrap('div').setStyle({
   *        backgroundImage: 'url(images/rounded-corner-top-left.png) top left'
   *      });
   *
   *  ##### Example 2
   *
   *  We can add a method to elements that makes it a bit easier to update them
   *  via [[Ajax.Updater]]:
   *
   *      Element.addMethods({
   *        ajaxUpdate: function(element, url, options) {
   *          if (!(element = $(element))) return;
   *          element.update('<img src="/images/spinner.gif" alt="Loading...">');
   *          options = options || {};
   *          options.onFailure = options.onFailure || defaultFailureHandler.curry(element);
   *          new Ajax.Updater(element, url, options);
   *          return element;
   *        }
   *      });
   *
   *  Now we can update an element via an Ajax call much more concisely than
   *  before:
   *
   *      $('foo').ajaxUpdate('/new/content');
   *
   *  That will use [[Ajax.Updater]] to load new content into the 'foo' element,
   *  showing a spinner while the call is in progress. It even applies a default
   *  failure handler (since we didn't supply one).
  **/
  function addMethods(methods) {
    let tagName;

    if (arguments.length === 0) addFormMethods();

    if (arguments.length === 2) {
      // Tag names have been specified.
      tagName = methods;
      methods = arguments[1];
    }

    if (!tagName) {
      Object.extend(Element.Methods, methods || {});
    } else {
      if (Object.isArray(tagName)) {
        for (var i = 0, tag; tag = tagName[i]; i++)
          addMethodsToTagName(tag, methods);
      } else {
        addMethodsToTagName(tagName, methods);
      }
    }

    mergeMethods(HTMLElement.prototype, Element.Methods);
    mergeMethods(HTMLElement.prototype, Element.Methods.Simulated, true);

    for (let tag in Element.Methods.ByTag) {
      const klass = findDOMClass( tag );
      if (Object.isUndefined(klass)) continue;
      mergeMethods(klass.prototype, ByTag[tag]);
    }

    Object.extend(Element, Element.Methods);
    Object.extend(Element, Element.Methods.Simulated);
    delete Element.ByTag;
    delete Element.Simulated;

    // We need to replace the element creation cache because the nodes in the
    // cache now have stale versions of the element methods.
    ELEMENT_CACHE = {};
  }

  Object.extend(GLOBAL.Element, {
    extend:     extend,
    addMethods: addMethods
  });

  GLOBAL.Element.extend.refresh = Prototype.emptyFunction;

  function addFormMethods() {
    // Add relevant element methods from the forms API.
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  Element.addMethods(methods);

})(this);
