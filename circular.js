/**
 * circular.js 0.2.0
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Mathias Kahl <mathias.kahl@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

var Circular = (function() {
    var controllerCount = 0;

    function Circular() {
        this.controllers = {}
        this.controllerInstances = {};

        document.addEventListener("DOMContentLoaded", this.init.bind(this))
    }

    /**
     * Carries out all necessary initializations, such as:
     *  - setting up controllers
     *  - initializing bindings
     */
    Circular.prototype.init = function() {
        // root controller
        var html = document.querySelector("html")
        html._controller = new Controller(html)
        this.rootController = html._controller
        this.rootController.initData()

        // initialize all the controllers
        var elements = document.querySelectorAll("*[controller]")
        for (var i = 0; i < elements.length; i++) {
            if (elements[i].hasOwnProperty("_controller")) continue
            var name = elements[i].getAttribute("controller")
            if (!(name in this.controllers)) throw new Error("Unknown controller '" + name + "'")

            var klass = this.controllers[name]

            if (typeof klass == "function")
                elements[i]._controller = new klass()
            else if (typeof klass == "object")
                elements[i]._controller = new function() {
                    this.context = klass
                }
            else
                throw Error("invalid controller definition")

            var parentController = findParentController(elements[i])
            var parentContext = parentController != null ? parentController.context : this.rootController.context

            Controller.call(elements[i]._controller, elements[i], parentContext)

            if (typeof this.controllerInstances[name] == "undefined") {
                this.controllerInstances[name] = [];
            }

            this.controllerInstances[name].push(elements[i]._controller)
        }

        // initialize all bindings
        this.setupBindings(document)
    }

    Circular.prototype.setupBindings = function(root) {
        root = root || document
        CollectionBinding.setup(root)
        ContentBinding.setup(root)
        InputBinding.setup(root)
        StyleBinding.setup(root)
        AttributeBinding.setup(root)
        ClassBinding.setup(root)
        Action.setup(root)
    }

    Circular.prototype.controller = function(name, klass) {
        this.controllers[name] = klass
    }

    Circular.prototype.getRootController = function() {
        return this.rootController
    }

    Circular.prototype.getControllerInstances = function(name) {
        return this.controllerInstances[name];
    }

    Circular.prototype.getControllerInstance = function(name) {
        return this.controllerInstances[name][0];
    }

    /*============= Controller =======================================================================================*/

    function Controller(element, parentContext) {
        this.element = element


        // every controller element needs an ID to unique identify it
        if (element.id == "") {
            element.id = "_controller-" + (controllerCount++);
        }

        // check if the user defined constructor defined an initial context dictionary
        if (typeof this.context != "undefined" && Object.keys(this.context).length > 0) {
            var init = this.context
            this.context = new Context(parentContext)

            for (key in init) {
                this.context[key] = init[key]
            }
        } else {
            this.context = new Context(parentContext)
        }

        Controller.prototype.initData.call(this)
    }

    Controller.prototype.initData = function() {
        // optionally load user defined context data from a script tag below the controller
        var script = this.element.querySelector("script[type='application/json']")

        if (script != null && findParentController(script) == this) {
            try {
                var text = script.innerText || script.textContent
                var data = JSON.parse(text)
            } catch (e) {
                console.log("Invalid JSON in " + text)
            }
            for (key in data) {
                this.context[key] = data[key]
            }
        }

        // adds a way to manually trigger updates of all bindings that rely on a certain property (manual refresh)
        var context = this.context
        context._refresh = function(propertyName) {
            context["_" + propertyName].refresh()
        }
    }

    /*============= Context ==========================================================================================*/

    /**
     * Hierarchical context. Inherits properties from parent context (read-only).
     * @param parent (optional)
     * @constructor
     */
    function Context(parent) {
        return Object.create(parent || Context.prototype, {})
    }

    Context.prototype.getOrCreateProperty = function(name) {
        if ("_"+name in this) {
            return this["_"+name]
        }

        var p = new Property(this, name, name in this ? this[name] : undefined)

        // save it as a hidden property using the name prepended with underscore
        Object.defineProperty(this, "_"+name, {
            configurable: true,
            enumerable: false,
            value: p,
            writable: true
        })

        // replace the existing property with an accessor to the hidden property
        Object.defineProperty(this, name, {
            configurable: true,
            enumerable: true,
            get: p.getValue.bind(p),
            set: p.setValue.bind(p)
        })

        return p
    }

    /**
     * Adds a binding to an existing property
     * @param property property name
     * @param binding
     */
    Context.prototype.addBinding = function(property, binding) {
        var p = this.getOrCreateProperty(property)
        p.addBinding(binding)

        // update the binding with the initial value if possible
        if (p.getValue() != undefined) {
            binding.update(this, undefined, p.getValue())
        }
    }

    Circular.prototype.Context = Context

    /*============= Property =========================================================================================*/

    function Property(context, name, initialValue) {
        this.context = context
        this.name = name
        this.value = initialValue
        this.bindings = []
    }

    Property.prototype.addBinding = function(binding) {
        this.bindings.push(binding)

        if (this.value instanceof Function) {
            // detect the dependencies of the function
            var depends = this.value.toString().match(/(this\.\w+)(?=\W)/g)
            for (var i = 0; i < depends.length; i++) {
                var symbol = depends[i].replace("this.", "")
                var property = binding.evaluationContext.getOrCreateProperty(symbol)
                property.bindings.push(binding)
            }
        }
    }

    Property.prototype.updateBindings = function(context, oldValue, newValue) {
        for (var i = 0; i < this.bindings.length; i++) {
            var usedContext = this.bindings[i].getUpdateContext(context)
            this.bindings[i].update(usedContext, oldValue, newValue)
        }
    }

    Property.prototype.getValue = function() {
        return this.value
    }

    Property.prototype.setValue = function(value) {
        var oldValue = this.value
        this.value = value

        if (oldValue != value) {
            this.updateBindings(this.context, oldValue, value)
        }
    }

    Property.prototype.refresh = function() {
        this.updateBindings(this.context, this.value, this.value)
    }

    /*============= Bindings =========================================================================================*/

    function Binding(expression, element, evaluationContext) {
        this.element = element
        this.expression = expression
        this.evaluationContext = evaluationContext
    }

    Binding.prototype.getUpdateContext = function(updateContext) {
        if (typeof this.evaluationContext != "undefined") return this.evaluationContext
        else return updateContext
    }

    Binding.prototype.update = function(context, oldValue, newValue) {
        // sub types of binding need to decide what to do when the value changes
    }

    /**
     * Attaches this binding to the nearest controller.
     * @return Controller the controller it was attached to
     */
    Binding.prototype.attach = function() {
        var controller = findParentController(this.element)
        if (controller == null) throw new Error("No parent controller found for element")
        this.evaluationContext = controller.context

        for (var i = 0; i < this.expression.symbols.length; i++) {
            var symbol = this.expression.symbols[i]
            controller.context.addBinding(symbol, this)
        }

        return controller
    }

    //--

    function FunctionBinding(func) {
        Binding.call(this, "", null, undefined)
        this.func = func
    }
    FunctionBinding.prototype = new Binding()

    FunctionBinding.prototype.update = function(context, oldValue, newValue) {
        this.func(context, oldValue, newValue)
    }

    //--

    function CollectionBinding(expression, element, evaluationContext) {
        Binding.call(this, expression, element, evaluationContext)

        this.template = element.innerHTML
        element.innerHTML = ''
        element.innerHTML = '<!-- Loading -->'
    }
    CollectionBinding.prototype = new Binding()
    Circular.prototype.CollectionBinding = CollectionBinding

    CollectionBinding.prototype.update = function(context) {
        this.element.innerHTML = ''
        var collection = this.expression.evaluate(context)

        if (!collection || !('length' in collection)) {
            return
        }

        for (var i = 0; i < collection.length; i++) {
            this.element.innerHTML += this.template
        }

        for (i = 0; i < collection.length; i++) {
            // create child controller
            var repeater = this.element.children[i]
            var controller = new Controller(repeater, context)

            // initialize the values
            if (typeof collection[i] == "object") {
                var keys = Object.keys(collection[i])
                for (var j = 0; j < keys.length; j++) {
                    var p = controller.context.getOrCreateProperty(keys[j])
                    var value = collection[i][keys[j]]
                    p.setValue(value)

                    // create a binding that will update the value in the original collection, whenever the context
                    // property is updated
                    var binding = (function(src, key) {
                        return new FunctionBinding(function(context, oldValue, newValue) {
                            src[key] = newValue
                        })
                    })(collection[i], keys[j])

                    p.addBinding(binding)
                }
            } else {
                var p = controller.context.getOrCreateProperty("item")
                p.setValue(collection[i])

                // create a binding that will update the value in the original collection, whenever the context
                // property is updated
                var binding = (function(src, key) {
                    return new FunctionBinding(function(context, oldValue, newValue) {
                        src[key] = newValue
                    })
                })(collection, i)

                p.addBinding(binding)
            }

            repeater._controller = controller

            // initialize other bindings for this repeater
            Circular.prototype.setupBindings(repeater)
        }
    }

    CollectionBinding.setup = function(root) {
        root = root || document
        var elements = root.querySelectorAll("*[bind-collection]")
        for (var i = 0; i < elements.length; i++) {
            var elem = elements[i]

            var exprText = elements[i].getAttribute("bind-collection")
            var expr = new BindingExpression(exprText)
            var binding = new CollectionBinding(expr, elements[i])
            var controller = binding.attach()
        }
    }

    //--

    /**
     * Binds the content of an HTML element to an expression
     * @param element DOMElement
     * @param expression Binding Expression
     * @constructor
     * @param evaluationContext
     */
    function ContentBinding(expression, element, evaluationContext) {
        Binding.call(this, expression, element, evaluationContext)
    }
    ContentBinding.prototype = new Binding()
    Circular.prototype.ContentBinding = ContentBinding

    ContentBinding.prototype.update = function(context, oldValue, newValue) {
        var value = this.expression.evaluate(context)
        if (typeof value != "undefined") {
            this.element.innerHTML = value
        }
    }

    /**
     * Searches for content binding declarations and sets up the bindings.
     */
    ContentBinding.setup = function(root) {
        root = root || document

        // TODO: Refactor binding setups
        var elements = root.querySelectorAll("*[bind-content]")
        for (var i = 0; i < elements.length; i++) {
            var initializeFromContent = true
            var exprText = elements[i].getAttribute("bind-content")
            if (exprText == null || exprText == "") {
                exprText = elements[i].innerHTML
                initializeFromContent = false
            }

            var expr = new BindingExpression(exprText)
            var binding = new ContentBinding(expr, elements[i])
            var controller = binding.attach()

            // if the content binding only references one symbol and has no prior definition,
            // just initialize it with the statically generated content of the element
            if (initializeFromContent && expr.symbols.length == 1 && controller.context[expr.symbols[0]] == undefined) {
                var init = elements[i].innerHTML.trim()

                // check if it's a number
                var match = init.match(/^(-?\d+(\.\d+)?)(%)?$/)
                if (match != null) {
                    init = parseFloat(match[1])
                }

                controller.context[expr.symbols[0]] = init
            }
        }
    }

    //--

    /**
     * Binds the value of an expression to a specific CSS style (set via the style attribute).
     * @param expression compiled binding expression
     * @param element HTML element
     * @param style CSS style name
     * @constructor
     */
    function StyleBinding(expression, element, style) {
        Binding.call(this, expression, element)
        this.style = style
    }
    StyleBinding.prototype = new Binding()
    Circular.prototype.StyleBinding = StyleBinding

    StyleBinding.prototype.update = function(context, oldValue, newValue) {
        this.element.style[this.style] = this.expression.evaluate(context)
    }

    StyleBinding.setup = function(root) {
        root = root || document
        var elements = root.querySelectorAll("*[bind-style]")
        for (var i = 0; i < elements.length; i++) {
            // expecting an object literal assigning expressions to css properties
            var text = elements[i].getAttribute("bind-style")
            if (text[0] != "{") text = "{" + text + "}"

            text = text.replace(/:\s+(.*)(,|\})/g, function(match, value, delim, offset, string) {
                value = value.replace(/([^\\])"/g, "$1\\\"")
                return ":\"" + value + "\"" + delim
            })
            var dict = eval("(" + text + ")")

            for (var key in dict) {
                var expr = new BindingExpression(dict[key])
                var binding = new StyleBinding(expr, elements[i], key)
                var controller = binding.attach()

                // if the referenced property is undefined, attempt to initialize it from HTML template
                if (expr.symbols.length == 1 && controller.context[expr.symbols[0]] == undefined) {
                    if (elements[i].style[key] != "") {
                        var init = elements[i].style[key]

                        // check if the value is a number
                        var match = init.match(/(-?\d+(\.\d+)?)(px|em|%|pt)?$/)
                        if (match != null) {
                            init = parseFloat(match[1])
                        }

                        controller.context[expr.symbols[0]] = init
                    }
                }
            }
        }
    }

    //---

    function AttributeBinding(expression, element, attr) {
        Binding.call(this, expression, element)
        this.attr = attr
    }
    AttributeBinding.prototype = new Binding()
    Circular.prototype.AttributeBinding = AttributeBinding

    AttributeBinding.prototype.update = function(context, oldValue, newValue) {
        this.element[this.attr] = this.expression.evaluate(context)
    }

    AttributeBinding.setup = function(root) {
        root = root || document
        // TODO: Refactor
        var elements = root.querySelectorAll("*[bind-attr]")
        for (var i = 0; i < elements.length; i++) {
            // expecting an object literal assigning expressions to css properties
            var text = elements[i].getAttribute("bind-attr")
            if (text[0] != "{") text = "{" + text + "}"

            text = text.replace(/:\s+(.*?)(,|\})/g, function(match, value, delim, offset, string) {
                value = value.replace(/([^\\])"/g, "$1\\\"")
                return ":\"" + value + "\"" + delim
            })
            var dict = eval("(" + text + ")")

            for (var key in dict) {
                var expr = new BindingExpression(dict[key])
                var binding = new AttributeBinding(expr, elements[i], key)
                var controller = binding.attach()

                // if the referenced property is undefined, attempt to initialize it from HTML template
                if (expr.symbols.length == 1 && controller.context[expr.symbols[0]] == undefined) {
                    if (elements[i][key] != "") {
                        var init = elements[i][key]

                        // check if the value is a number
                        var match = init.match(/(-?\d+(\.\d+)?)(px|em|%|pt)$/)
                        if (match != null) {
                            init = parseFloat(match[1])
                        }

                        controller.context[expr.symbols[0]] = init
                    }
                }
            }
        }
    }

    //---

    function InputBinding(expression, element) {
        Binding.call(this, expression, element)

        // TODO: Assumes that input names are unique on page. Fix that
        this.type = "text"
        this.arity = 1

        if (element.tagName == "INPUT") {
            var inputType = element.type.toLowerCase()
            var controllerId = findParentController(element).element.id
            var query = "#" + controllerId + " " + element.tagName+"[name='"+element.name+"']"
            this.arity = document.querySelectorAll(query).length

            // determine binding type based on input type
            switch (inputType) {
                case "checkbox":
                    this.type = this.arity == 1 ? "toggle" : "multi-select"
                    break
                case "radio":
                    this.type = "select"
                    break
                default:
                    this.type = "text"
            }
        } else if (element.tagName == "SELECT") {
            if (element.multiple) {
                this.type = "multi-select"
            } else {
                this.type = "select"
            }
        } else if (element.tagName == "TEXTAREA") {
            this.type = "text"
        }
    }
    InputBinding.prototype = new Binding()

    InputBinding.prototype.update = function(context, oldValue, newValue) {
        if (this.type == "select" || this.type == "multi-select") {
            // look for the element and check it
            var value = this.expression.evaluate(context)
            var controllerId = findParentController(this.element).element.id
            var query = "#" + controllerId + " " + this.element.tagName+"[name='"+this.element.name+"']"
            var elements = document.querySelectorAll(query)
            for (var i = 0; i < elements.length; i++) {
                if (elements[i].value == value) {
                    elements[i].checked = true
                    return
                }
            }
        } else {
            var replacement = this.expression.evaluate(context)
            if (this.element.value != replacement) {
                this.element.value = replacement
            }
        }
    }

    InputBinding.prototype.bind = function(context) {
        var self = this

        if (this.type == "text" || this.type == "toggle") {
            function onchange(e) {
                context[self.expression.symbols[0]] = self.getElementValue(self.element)
            }

            this.element.addEventListener("change", onchange, false)
            this.element.addEventListener("keyup", onchange, false)
        } else if (this.type == "multi-select" || this.type == "select") {
            this.element.addEventListener("change", function(e) {
                context[self.expression.symbols[0]] = self.getElementValue(this)
            })
        }

        if (!this.element.hasOwnProperty("bindings")) {
            this.element.bindings = []
        }

        this.element.bindings.push(this)
    }

    InputBinding.prototype.read = function(context) {
        context = context || this.evaluationContext
        context[this.expression.symbols[0]] = this.getElementValue(this.element)
    }

    InputBinding.prototype.getElementValue = function(elem) {
        var init = elem.value

        // check if the value is a number
        var match = init.match(/^(-?\d+(\.\d+)?)(px|em|%|pt)?$/)
        if (match != null) {
            init = parseFloat(match[1])
        }

        if (this.type == "toggle") {
            init = elem.checked
        } else if (this.type == "select") {
            var controllerId = findParentController(elem).element.id
            var query = "#" + controllerId + " input[name='" + elem.name + "']"
            var elements = document.querySelectorAll(query)
            for (var i = 0; i < elements.length; i++) {
                if (elements[i].checked) {
                    init = elements[i].value
                    break
                }
            }
        }

        if (init == "true") init = true
        else if (init == "false") init = false

        return init
    }

    InputBinding.setup = function(root) {
        root = root || document
        var elements = root.querySelectorAll("*[bind-input]")
        for (var i = 0; i < elements.length; i++) {
            var elem = elements[i]
            var expr = elem.getAttribute("bind-input")
            if (expr == "") expr = elem.getAttribute("name")
            expr = new BindingExpression(expr)

            var binding = new InputBinding(expr, elem)
            var ctrl = binding.attach()

            // if the referenced property is undefined, attempt to initialize it from HTML template
            if (expr.symbols.length == 1 && ctrl.context[expr.symbols[0]] == undefined) {
                ctrl.context[expr.symbols[0]] = InputBinding.prototype.getElementValue(elem)
            }

            binding.bind(ctrl.context)
        }
    }

    //---

    function ClassBinding(expression, element, klass) {
        Binding.call(this, expression, element)
        this.klass = klass
        this.previousClasses = []
    }
    ClassBinding.prototype = new Binding()
    Circular.prototype.ClassBinding = ClassBinding

    ClassBinding.prototype.update = function(context, oldValue, newValue) {
        if (this.klass === null) {
            // if no klass is specified the binding expression is expected to generate a list of classes

            // remove the previously added classes
            if (this.previousClasses.length > 0) {
                this.removeClasses(this.previousClasses)
            }

            // generate list of classes to add
            var newClasses = this.expression.evaluate(context)

            // add the classes to this.element
            if (typeof newClasses == "string") {
                this.previousClasses = this.addClasses(newClasses.split(" "))
            } else if (newClasses instanceof Array) {
                this.previousClasses = this.addClasses(newClasses)
            }
        } else {
            // a class was defined, so interpret the expression as a boolean one to determine whether to add it or not
            if (this.expression.evaluate(context)) {
                this.addClasses([this.klass])
            } else {
                this.removeClasses([this.klass])
            }
        }
    }

    ClassBinding.prototype.addClasses = function(classes) {
        var current = this.element.className.split(" ")
        var add = classes.filter(function(c) { return c != "" && current.indexOf(c) < 0 })
        this.element.className = current.concat(add).join(" ")
        return add
    }

    ClassBinding.prototype.removeClasses = function(classes) {
        var current = this.element.className.split(" ")
        current = current.filter(function(c) { return c != "" && classes.indexOf(c) < 0 })
        this.element.className = current.join(" ")
    }

    ClassBinding.setup = function(root) {
        root = root || document
        var elements = root.querySelectorAll("*[bind-class]")
        for (var i = 0; i < elements.length; i++) {
            var text = elements[i].getAttribute("bind-class")

            if (text[0] == "{") {
                // assuming map of classes and boolean expressions
                text = text.replace(/:\s+(.*?)(,|\})/g, function(match, value, delim, offset, string) {
                    value = value.replace(/([^\\])"/g, "$1\\\"")
                    return ":\"" + value + "\"" + delim
                })
                var dict = eval("(" + text + ")")

                for (var key in dict) {
                    var expr = new BindingExpression(dict[key])
                    var binding = new ClassBinding(expr, elements[i], key)
                    binding.attach()
                }
            } else {
                // assuming an expression producing a list of classes
                var expr = new BindingExpression(text)
                var binding = new ClassBinding(expr, elements[i], null)
                binding.attach()
            }
        }
    }

    /*============= Actions ==========================================================================================*/

    function ClickAction(expression, element) {
        Action.call(this, expression, element, "click")
    }

    Action.setup = function(root) {
        root = root || document
        var elements = root.querySelectorAll("*[bind-click]")
        for (var i = 0; i < elements.length; i++) {
            var expr = new BindingExpression(elements[i].getAttribute("bind-click"))
            var action = new ClickAction(expr, elements[i])
        }

        elements = root.querySelectorAll("form[bind-submit]")
        for (i = 0; i < elements.length; i++) {
            expr = new BindingExpression(elements[i].getAttribute("bind-submit"))
            action = new Action(expr, elements[i], "submit")
        }
    }

    function Action(expression, element, event) {
        var ctrl = findParentController(element, true)

        element.addEventListener(event, function(e) {
            ctrl.context._event = e
            if(!expression.evaluate(ctrl.context)) {
                e.preventDefault()
                return false
            } else {
                return true
            }
        }, false)
    }

    /*============= Binding expressions ==============================================================================*/

    function BindingExpression(str) {
        this.str = str
        this.symbols = this.parseSymbols()
    }

    /**
     * Evaluates the expression in the given context
     * @param context Context
     */
    BindingExpression.prototype.evaluate = function(context) {
        var expr = this.str
        var calls = {}

        for (var i = 0; i < this.symbols.length; i++) {
            var symbol = this.symbols[i]
            if (!(symbol in context))
                throw new Error("Unknown property '" + symbol + "' in expression '" + this.str + "'")

            if (typeof context[symbol] == "function") {
                calls[symbol] = context[symbol].bind(context)
                expr = expr.replace(symbol, "calls." + symbol)
                if (!expr.match(new RegExp("calls."+symbol+"\\("))) {
                    expr = expr.replace("calls." + symbol, "calls." + symbol + "()")
                }
            } else {
                var pattern = new RegExp("([^\\.]|^)" + symbol)
                expr = expr.replace(pattern, "$1context."+symbol)
            }
        }

        try {
            return eval(expr)
        } catch (e) {
            return null
        }
    }

    /**
     * Parses out symbols (i.e. property names). Ignores "and" and "or".
     */
    BindingExpression.prototype.parseSymbols = function() {

        // remove strings
        var str = this.str.replace(/'[^']*?'/, '').replace(/"[^"]*?"/, '')

        var matches = str.match(/(^|\s|\W)(\w+)(\W|\s|$)/g)
        var symbols = []
        if (matches == null) return []

        for (var i = 0; i < matches.length; i++) {
            var match = matches[i].trim()
            if (match[0] == "'" || match[0] == '"') continue // skip strings
            var symbol = match.replace(/(^\W)|(\W$)/g, "") // remove non word characters from borders

            // skip logical symbols, numbers
            if (["and", "or", "if", "else"].indexOf(symbol) >= 0 || symbol in symbols) continue
            if (symbol.match(/^-?\d+(\.\d+)?$/)) continue

            symbols.push(symbol)
        }
        return symbols
    }

    /*============= Helpers ==========================================================================================*/

    function findParentController(element, includeSelf) {
        if (includeSelf && "_controller" in element) return element._controller

        var parent = element.parentElement
        while (parent != null) {
            if ("_controller" in parent) {
                return parent._controller
            }
            parent = parent.parentElement
        }

        // if nothing is found return the root controller
        return document.querySelector("html")._controller
    }

    return new Circular()
})()

if (typeof define === "function" && define.amd) {
    define("circular", [], function () {
        return Circular;
    });
}