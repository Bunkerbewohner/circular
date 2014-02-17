/**
 * circular.js
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
    function Circular() {
        this.controllers = {}

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
            var name = elements[i].getAttribute("controller")
            if (!(name in this.controllers)) throw new Error("Unknown controller '" + name + "'")

            var klass = this.controllers[name]
            elements[i]._controller = new klass()

            var parentController = findParentController(elements[i])
            var parentContext = parentController != null ? parentController.context : this.rootController.context

            Controller.call(elements[i]._controller, elements[i], parentContext)
        }

        // initialize all bindings
        ContentBinding.setup(this)
        StyleBinding.setup(this)
        ClassBinding.setup(this)
        ClickAction.setup(this)
    }

    Circular.prototype.controller = function(name, klass) {
        this.controllers[name] = klass
    }

    Circular.prototype.getRootController = function() {
        return this.rootController
    }

    /*============= Controller =======================================================================================*/

    function Controller(element, parentContext) {
        this.element = element

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

        this.initData()
    }

    Controller.prototype.initData = function() {
        // optionally load user defined context data from a script tag below the controller
        var script = this.element.querySelector("script[type='application/json']")

        if (script != null && findParentController(script) == this) {
            var data = JSON.parse(script.innerText)
            for (key in data) {
                this.context[key] = data[key]
            }
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

    /**
     * Adds a binding to an existing property
     * @param property property name
     * @param binding
     */
    Context.prototype.addBinding = function(property, binding) {
        // check if the background property already exists
        if ("_"+property in this) {
            // if yes, just add the binding
            this["_"+property].addBinding(binding)
            binding.update(this, this[property], this[property])
            return
        }

        // if not create the new background property
        var p = new Property(this, property, property in this ? this[property] : undefined)
        p.addBinding(binding)

        // if the context defines an initial value, update the binding with it
        if (p.getValue() != undefined) binding.update(this, undefined, p.getValue())

        // save it as a hidden property using the name prepended with underscore
        Object.defineProperty(this, "_"+property, {
            configurable: true,
            enumerable: false,
            value: p,
            writable: true
        })

        // replace the existing property with an accessor to the hidden property
        Object.defineProperty(this, property, {
            configurable: true,
            enumerable: true,
            get: p.getValue.bind(p),
            set: p.setValue.bind(p)
        })
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
    }

    Property.prototype.updateBindings = function(context, oldValue, newValue) {
        for (var i = 0; i < this.bindings.length; i++) {
            this.bindings[i].update(context, oldValue, newValue)
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

    /*============= Bindings =========================================================================================*/

    function Binding(expression, element) {
        this.element = element
        this.expression = expression
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

        for (var i = 0; i < this.expression.symbols.length; i++) {
            var symbol = this.expression.symbols[i]
            controller.context.addBinding(symbol, this)
        }

        return controller
    }

    //--

    /**
     * Binds the content of an HTML element to an expression
     * @param element DOMElement
     * @param expression Binding Expression
     * @constructor
     */
    function ContentBinding(expression, element) {
        Binding.call(this, expression, element)
    }
    ContentBinding.prototype = new Binding()
    Circular.prototype.ContentBinding = ContentBinding

    ContentBinding.prototype.update = function(context, oldValue, newValue) {
        this.element.innerHTML = this.expression.evaluate(context)
    }

    /**
     * Searches for content binding declarations and sets up the bindings.
     */
    ContentBinding.setup = function(circular) {
        // TODO: Refactor binding setups
        var elements = document.querySelectorAll("*[bind-content]")
        for (var i = 0; i < elements.length; i++) {
            var exprText = elements[i].getAttribute("bind-content")
            var expr = new BindingExpression(exprText)
            var binding = new ContentBinding(expr, elements[i])
            var controller = binding.attach()

            // if the content binding only references one symbol and has no prior definition,
            // just initialize it with the statically generated content of the element
            if (expr.symbols.length == 1 && controller.context[expr.symbols[0]] == undefined) {
                var init = elements[i].innerHTML.trim()

                // check if it's a number
                var match = init.match(/^(\d+(\.\d+)?)(%)?$/)
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

    StyleBinding.setup = function(circular) {
        var elements = document.querySelectorAll("*[bind-style]")
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
                        var match = init.match(/(\d+(\.\d+)?)(px|em|%|pt)$/)
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

    ClassBinding.setup = function(circular) {
        var elements = document.querySelectorAll("*[bind-class]")
        for (var i = 0; i < elements.length; i++) {
            var text = elements[i].getAttribute("bind-class")

            if (text[0] == "{") {
                // assuming map of classes and boolean expressions
                text = text.replace(/:\s+(.*)(,|\})/g, function(match, value, delim, offset, string) {
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
        var ctrl = findParentController(element)

        element.addEventListener("click", function() {
            expression.evaluate(ctrl.context)
        })
    }

    ClickAction.setup = function(circular) {
        var elements = document.querySelectorAll("*[bind-click]")
        for (var i = 0; i < elements.length; i++) {
            var expr = new BindingExpression(elements[i].getAttribute("bind-click"))
            var action = new ClickAction(expr, elements[i])
        }
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
        var expr = this.str.replace("and", "&&").replace("or", "||")

        for (var i = 0; i < this.symbols.length; i++) {
            var symbol = this.symbols[i]
            if (!(symbol in context))
                throw new Error("Unknown property '" + symbol + "' in expression '" + this.str + "'")

            if (typeof context[symbol] == "function") {
                var __call__ = context[symbol].bind(context)
                expr = expr.replace(symbol, "__call__")
            } else {
                expr = expr.replace(symbol, "context."+symbol)
            }
        }

        return eval(expr)
    }

    /**
     * Parses out symbols (i.e. property names). Ignores "and" and "or".
     */
    BindingExpression.prototype.parseSymbols = function() {
        var matches = this.str.match(/(^|\s|\W)(\w+)(\W|\s|$)/g)
        var symbols = []
        if (matches == null) throw new Error("no symbols found in expr '" + this.str + "'")
        for (var i = 0; i < matches.length; i++) {
            var match = matches[i].trim()
            if (match[0] == "'" || match[0] == '"') continue // skip strings
            var symbol = match.replace(/(^\W)|(\W$)/g, "") // remove non word characters from borders

            // skip logical symbols, numbers
            if (symbol in ["and", "or"] || symbol in symbols) continue
            if (symbol.match(/^\d+(\.\d+)?$/)) continue

            symbols.push(symbol)
        }
        return symbols
    }

    /*============= Helpers ==========================================================================================*/

    function findParentController(element) {
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