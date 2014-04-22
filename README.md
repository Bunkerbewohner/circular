Circular Documentation
======================
----------

Circular is a simple JavaScript library for creating bindings between values and HTML elements. It was inspired by AngularJS, but is tailored towards classic web apps with server-side templates.

Circular allows you gradually enhance existing multi-page apps that still rely on server-side templating and provides easy JavaScript data bindings, as shown in the following full example (*examples/usecase0.html*):
```html
<!doctype html>
<html>
<head>
	<title>Send a tweet</title>
	<script src="circular.js"></script>
</head>
<body>
	<form action="send-tweet.php" method="POST">
		<h1>Write a Tweet</h1>
		<textarea name="text" cols="70" rows="4" bind-input><?= $text ?></textarea>
		<p>Remaining Characters: <span bind-content>140 - text.length</span></p>
		<input type="submit" value="send">
	</form>
</body>
</html>
```

Quick Start
------------

This chapter attempts to give a short overview over Circular and to use it. For more detailed information refer to the following chapters that explain the different concepts in detail.

The basic blocks of Circular are **controllers** and **bindings**. Controllers are JavaScript objects that consist of data and functions. Data can be bound to HTML elements and attributes and functions can be bound both to **actions** such as clicks and form submits, as well as HTML elements and attributes.

**Basic Controller Example**:

```javascript
Circular.controller("MyController", {
	name: "Joffrey",
	alive: true,
	kill: function() {
		this.alive = false
	}
})
```

This controller defines two data properties ("name" and "alive") that can be used for data bindings, as well as a function "kill" that can be bound to an action and can access the data properties directly.

The following example shows how to make use of this controller in a simple HTML page that includes the Circular library. It demonstrates the usage of **content bindings**, **action bindings** and **attribute bindings**. Detailed information about the different kinds of bindings can be found in the chapter "Bindings".

```html
<!doctype html>
<html>
<head>
	<title>Testpage</title>
	<script src="circular.js"></script>
    <script>
		Circular.controller("MyController", {
			name: "Joffrey",
			alive: true,
			showStatus: function() {
				return this.alive ? "alive!" : "dead!"
			},
			kill: function() {
				this.alive = false
			}			
		})
	</script>
</head>
<body controller="MyController">
	<h1>King <span bind-content="name"></span> is <span bind-content="showStatus()"></span></h1>

	<button bind-click="kill()" bind-attr="{disabled: !alive}">Kill <span bind-content="name"></span></button>
</body>
</html>
```

After including the circular library the controller is defined as shown earlier. In the HTML body **content bindings** between two *span* elements and the *name* property are created using the *bind-content* attribute. 

The value of the attribute is a so called **binding expression**. Binding expressions are arbitrary JavaScript expressions that make use of data properties defined in the controller. Every time one of the referenced properties changes, the expression is automatically re-evaluated. How the new value is used depends on the kind of binding. The content binding in this case simply replaces the HTML elements' content (*innerHTML* property) with the new value. While in the first content binding the expression simply evaluates to the data property "name", the second binding uses a function defined in the controller to return a string depending on the value of the data property "alive".

The other type of binding used in the example is the **attribute binding**. Attribute bindings allow binding values to arbitrary HTML attributes. In this case the binding is defined in form of a JavaScript object where the keys represent the attribute names and the values are the binding expressions. In this case the value of the attribute "disabled" is bound to the controller's data property "alive". Consequently the button will be disabled if "alive" is set to false. 

Finally, the attribute "bind-click" is used to bind the controller's "kill" function to the *click* event of the button. Every time the button is clicked the "kill" function will be executed, which in this case sets "alive" to false and therefore disables the button and changes Joffrey's status to "dead!".

And these are the basics of Circular. For more information about the different binding types refer to the chapter "Bindings".

Controller
----------

A controller is a plain JavaScript object that encapsulates data and functions. All data properties are automatically watched for changes and update all bindings that depend on them. Data properties can be used for different kinds of data bindings as explained in the next chapter "Bindings". Functions can be bound to actions such as "click" and "submit" events of HTML elements, as explained in the chapter "Actions".

Controllers are defined using the function ```Circular.controller```:

```javascript
Circular.controller("ControllerName", {
	data1: "value1",
	data2: "value2",
	action1: function() {
		//...
	}
})
``` 

To access controller data and functions it has to be attached to a HTML element using the "controller" attribute:

```html
<div controller="ControllerName">
	<h1>Welcome, <span bind-content="data1"></span>!</h1>
</div>
```

Within the associated element all bindings refer to properties of the specified controller. If a referenced property's value is changed in some way the change will be automatically reflected in the HTML. 

Circular automatically creates a **Root controller** that is attached to the HTML element of the document. If no other controller is specified all bindings will refer to the data context of that root controller.

### Bound Functions

Functions defined in the controller can not only be bound to actions, but also be used in regular content bindings etc. Each time a property referenced in the function is changed, the whole function will be reevaluated and the associated bindings are updated. For this to work the properties have to be explicitly referenced via "this":

```html
<!-- examples/usecase5.html -->
<!doctype html>
<html>
<head>
	<title>Function Binding</title>
	<script src="circular.js"></script>
    <script>
        Circular.controller("Controller", {
            greeting: function() {
                // the property "name" is implicitly created through the input binding below
                return "Hello, " + this.name + "!"
            }
        })
    </script>
</head>
<body controller="Controller">
    <p><input name="name" value="Margaret" bind-input></p>
	<p bind-content="greeting()"></p>
</body>
</html>
```

Note that since binding expressions are regular JavaScript, you have to add parentheses to call the function as per normal. Every time the "name" property is changed, the "greeting" function will be evaluated newly and the bindings are updated with the resulting value (in this case "Hello, Margaret!"). Consequently changing the name in the input field will automatically update the greeting.

### Automatic Update of Bindings

Circular is very simplistic in its implementation and only triggers updates when a data property's value is changed. Note that this mechanism **does not** consider changes in properties of reference values. I.e. changing the elements of an array or properties of an object do not trigger updates. The whole value (or reference) has to be replaced. Another way to look at this is that all data properties are treated as immutable when reading from them. However, some binding types may update objects and arrays in place when writing out changes. A good example for this are **Collection Bindings** (see chapter "Bindings").

The following example shows which operations trigger updates of bindings. You can find the complete example in the Git repository under "examples/usecase2.html".

```javascript
<script>
Circular.controller("Test", {
	"title": "My Shopping List",
	"items": ["Milk", "Bread", "Eggs"],
	"meta": {
		"date": "2014-04-17",
		"author": "Jamie"
	}
})
</script>

<div class="shopping-list" controller="Test">
	<h1 bind-content="title"></h1>
	<p>Created by <span bind-content="meta.author"></span> on <span bind-content="meta.date"></span></p>

	<ul bind-collection="items">
		<li><span bind-content="item"></span></li>
	</ul>

    <button bind-click="title = 'New Title'">Change Title</button><br>

    <button bind-click="items.push('Chocolate')"
            title="This method adds an item but doesn't trigger an update">Add Item wrongly</button>
    <button bind-click="_refresh('items')"
            title="Manually triggers an update of the bindings on items">Manually refresh items</button>
    <button bind-click="items = items.concat(['Potatoes'])"
            title="Replaces the items as a whole and therefore triggers an update">Add Item correctly</button><br>

    <button bind-click="meta.author = 'Tywin'"
            title="This method changes an object property but doesn't trigger an update">Change Object Property wrongly</button>
    <button bind-click="_refresh('meta')"
            title="Manually triggers an update of the bindings on meta">Manually refresh object</button>
    <button bind-click="meta = {'date': meta.date, 'author': 'Tyrion'}"
            title="Replaces the meta object as a whole and therefore triggers an update">Change Object correctly</button>
</div>
```

As demonstrated in the example binding updates are only triggered when the property value (which can be a reference) changes. Also data properties can be objects themselves and properties of objects can be access in binding expressions using the "." operator, e.g. ```meta.name```.

Property updates can be manually triggered using ```Circular.refresh("propertyName")```. This will cause all bindings that depend on the specified property to be updated.

**Function Bindings**

Functions are re-evaluated when any data property referenced directly in their function body is updated. However, this currently does not include other controller functions called in the function body:

```javascript
Circular.controller("Controller", {
	n: 4,
	square: function() {
		return n * n
	},
	quadruple: function() {
		var nq = this.square()
		return nq * nq
	}
}
```

In the example above changing the property "n" will lead to "square" being reevaluated, though "quadruple" is not. This is because the implementation simply checks for lexical references to data properties in the form of "this.$property". This will likely be improved in future versions of Circular.

### Explicit Context Initialization

By default a controller's context consists of the data properties that are defined in the controller itself. These properties can be accessed within all controller functions and from bindings of children of the HTML element that the controller was attached to.

Additionally a context can be initialized through a JSON block:

```html
<div controller="MyController">
	<script type="application/json">{
		"name": "Mathias",
		"city": "Berlin"
	}</script>
</div>
```

Note that the block has to be valid JSON, i.e. keys have to be defined as double-quoted strings. Properties defined in this way overwrite properties defined in the controller definition and can also add new properties.

The root controller's context can be initialized using a JSON script block at the beginning of the document's body, or anywhere else, as long as it the block is not a child element of a different controller.

### Implicit Context Initialization

By default Circular attempts to create non-existing properties that are referenced in binding expressions and initialize them with their value as defined in HTML. This works only with content, style and attribute bindings. The following example (*examples/usecase3.html*) shows the creation of implicit properties in the root controller through HTML.

```html
<html>
<head>
	<title>Implicit Properties of the Root Controller</title>
	<script src="circular.js"></script>
</head>
<body>
	<p>Hello, <span bind-content="name">Tobias</span>!</p>
	<p>Change Name: <input name="name" bind-input></p>
</body>
</html>
```

As you can see no controller is explicitly created, instead the implicitly created root controller of the HTML element is used. Additionally, the property "name" is implicitly created through the content binding and initialized with the existing content of the bound HTML element.

This feature is especially useful in conjunction with server-side templating frameworks because it allows you to simply augment existing templates rather than also defining all properties separately through a JSON object. In that case the content of the *span* element would be filled in on the server side through the template engine, e.g.:

```php
<p>Hello, <span bind-content="name"><?=$username?></span>!</p>
```

### Controller Inheritance

Controllers support nesting and inheritance. Every controller that is attached to an HTML element automatically inherits from the next parent controller:

```html
<script>
Circular.controller("A", { a: "controller A" })
Circular.controller("B", { b: "controller B" })
Circular.controller("C", { c: "controller C", a: "overwritten in C" })
</script>
<div controller="A">
	<h1>Context A</h1>
	<p>A = <span bind-content="a"/></p> <!-- Results in: A = controller A -->
	<p>B = <span bind-content="b"/></p> <!-- Results in: B = -->
	<p>C = <span bind-content="c"/></p> <!-- Results in: C = -->

	<div controller="B">
		<h2>Context B</h2>

		<p>A = <span bind-content="a"/></p> <!-- Results in: A = controller A -->
		<p>B = <span bind-content="b"/></p> <!-- Results in: B = controller B -->
		<p>C = <span bind-content="c"/></p> <!-- Results in: C = -->

		<div controller="C">
			<h3>Context C</h3>

			<p>A = <span bind-content="a"/></p> <!-- Results in: A = overwritten in C -->
			<p>B = <span bind-content="b"/></p> <!-- Results in: B = controller B -->
			<p>C = <span bind-content="c"/></p> <!-- Results in: C = controller C -->
		</div>
	</div>
</div>
```

Properties defined in child controllers that already exist in parent controllers are overwritten.

Bindings
--------

Bindings connect data properties with HTML elements and functions with events. It follows a comprehensive list of all binding types. 

Most of these bindings are **one-way** bindings. I.e. changes of the JavaScript values will change the HTML, but not vice versa. Only **Input Bindings** reflect changes both ways.

### Content Binding

```html
<p bind-content="description">This is the initial description.</p>
```

Content Bindings bind the values of data properties to the content of HTML elements. Every time the data property's value is changed the content of the HTML element will be changed accordingly.
The attribute's value refers to a data property by name. Its content is bound to the HTML element's content. 

Content bindings support implicit context initialization: If a referenced property does not yet exist it is created automatically. If an existing property has no value, it will be initialized with the HTML elements content.

If the HTML element's content is not needed for initialization the binding expression can also be defined in the content instead of the **bind-content** attribute value:

```html
<script type="application/json">{
	"description": "This is the initial description"
}</script>
<p bind-content>description + ' (' + description.length + ')'</p>
``` 

This example will result in the following HTML: ```<p>This is the initial description (31)</p>```.

### Attribute Binding

```html
<script type="application/json">{ "loading": false }</script>
<button bind-attr="{disabled: loading}" bind-click="loading = true">Submit</button>
```

Attribute bindings can be used to bind data properties to arbitrary attributes of an HTML element. By default the binding expression has to be a JSON object where each key represents an HTML attribute and the associated expression is evaluated to determine the HTML attribute's value.

Of course functions can also be bound, as demonstrated in the following example:

```html
<!-- examples/usecase6.html -->
<script>
    Circular.controller("Controller", {
        numRows: function() {
            return Math.max(4, this.text.split("\n").length)
        }
    })
</script>
<form controller="Controller">
	<textarea name="text" rows="4" cols="70" bind-attr="{rows: numRows()}" bind-input></textarea>
</form>
```

In the example above the "rows" attribute of the textarea is bound to the function "numRows", which
returns number of lines of the "text" property (but at least 4). The "text" property is bound to the textarea's content. As a result the textarea automatically grows larger when the user enters more than four lines of text. 

Attribute bindings also support **implicit context initialization**:

```html
<html lang="en" bind-attribute="{lang: language}">
```

In the example above the "lang" attribute is bound to a not yet existing property "language". Through implicit context initialization the property is created in the root controller and initialized with the current value of the attribute ("en"). This is useful when the *lang* attribute is generated through server-side templating (like in WordPress) and you want to use the value in your JavaScript code.

### Style Binding

```html
<!-- examples/style-binding.html -->
<div class="progress">
    <!-- bind-style creates the property "progress" and binds the expression "progress + '%'" to the "width" style.
         The property value is automatically initialized from the currently set style value.
         Values with units such as %, em, pt, and px are automatically converted to numbers. -->
    <div class="progress-bar" style="width: 50%" bind-style="{width: progress+'%'}">
        &nbsp;Loading...
     </div>
</div>

<!-- the buttons manipulate the implicitly created numeric progress property -->
<button bind-click="progress -= 10">Dec</button>
<button bind-click="progress += 10">Inc</button>
```

Style bindings work similarly to attribute bindings, except they bind to style attributes (i.e. attributes of the element's "style" property). Like content and attribute bindings, they support implicit initialization of properties. In the example above the property "progress" is initialized with the current value of the "width" style. For style attributes units are automatically stripped from initialization values. Therefore the initial value in the example is the numeric value 50, rather than the string "50%".  

### Class Binding

```html
<script type="application/json">{ "errors": [] }</script>
<button bind-class="{warning: errors.length > 0}" bind-click="errors = ['ERROR']">Send Now</button>
```

Class bindings can be used to conditionally assign classes to an HTML element. The syntax is similar to attribute and style bindings, except the binding expressions are boolean and their value determines whether the class is assigned (true) or not (false). 

### Collection Binding

```html
<script type="application/json">{
	"items": ["Milk", "Bread", "Butter"]
}</script>
<ul bind-collection="items">
    <li><span bind-content="item"></span></li>
</ul>
```

Collection bindings can be used to display lists. When a an array property is bound to an element (&lt;ul&gt; in the example), the first child element of that element (&lt;li&gt; in the example) will be repeated for every list item. Additionally a new controller will be created for every child element that holds the data of the array item. Within the child element (&lt;li&gt; in the example) the properties of the array item can be referenced in further bindings as per usual. If the array item is an atomic value, such as a number or string, it can be referenced by the name "item". When the JavaScript array is updated, the list is automatically updated. Refer to the chapter "Automatic Update of Bindings" to see how to update array properties correctly. 

For an example of a collection binding using a list of JavaScript objects, see "examples/usecase2.html".

### Action Bindings

```html
<script type="application/json">{
	"onsubmit": function() {
		alert("Form was submitted")
	},
	"onclick": function() {
		alert("button was clicked")
	}
}</script>

<form bind-submit="onsubmit()">
	<button bind-click="onclick()">SEND</button>
</form>
```

Action bindings simply add controller functions as event listeners to certain events. Right now the only supported events are the **click** and **submit** events. The event is not passed directly to the function - instead it can be accessed through the internal property "_event".
