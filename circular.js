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
        this.rootContext = new Context()
        document.addEventListener("DOMContentLoaded", this.init.bind(this))
    }

    /**
     * Carries out all necessary initializations, such as:
     *  - setting up controllers
     *  - initializing bindings
     */
    Circular.prototype.init = function() {
        // initialize all the controllers
        var elements = document.querySelectorAll("*[controller]")
        for (var i = 0; i < elements.length; i++) {
            var name = elements[i].getAttribute("controller")
            if (!(name in this.controllers)) throw new Error("Unknown controller '" + name + "'")

            var klass = this.controllers[name]
            elements[i]._controller = new klass()

            var parentController = findParentController(elements[i])
            var parentContext = parentController != null ? parentController.context : this.rootContext

            Controller.call(elements[i]._controller, elements[i], parentContext)
        }

        // initialize all bindings
        ContentBinding.setup()
    }

    Circular.prototype.controller = function(name, klass) {
        this.controllers[name] = klass
    }

    /*============= Controller =======================================================================================*/

    function Controller(element, parentContext) {
        this.element = element

        if (typeof this.context != "undefined" && Object.keys(this.context).length > 0) {
            var init = this.context
            this.context = new Context(parentContext)

            for (key in init) {
                this.context[key] = init[key]
            }
        } else {
            this.context = new Context(parentContext)
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
        } else if (property in this) {
            // otherwise we have to create it first
            var p = new Property(this, property, this[property])
            p.addBinding(binding)

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
        } else {
            throw new Error("Property '" + property + "' not defined in this context")
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
     */
    Binding.prototype.attach = function() {
        var controller = findParentController(this.element)
        if (controller == null) throw new Error("No parent controller found for element")

        for (var i = 0; i < this.expression.symbols.length; i++) {
            var symbol = this.expression.symbols[i]
            controller.context.addBinding(symbol, this)
        }
    }

    //--

    /**
     * Binds the content of an HTML element to a property
     * @param element DOMElement
     * @param expression Expression (optional)
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
    ContentBinding.setup = function() {
        var elements = document.querySelectorAll("*[bind-content]")
        for (var i = 0; i < elements.length; i++) {
            var exprText = elements[i].getAttribute("bind-content")
            var expr = new BindingExpression(exprText)
            var binding = new ContentBinding(expr, elements[i])
            binding.attach()
        }
    }

    //--

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

            expr = expr.replace(symbol, "context."+symbol)
        }

        return eval(expr)
    }

    /**
     * Parses out symbols (i.e. property names). Ignores "and" and "or".
     */
    BindingExpression.prototype.parseSymbols = function() {
        var matches = this.str.match(/(?:^|\s|!)(\w+)(\s|$)/g)
        var symbols = []
        if (matches == null) throw new Error("no symbols found in expr '" + this.str + "'")
        for (var i = 0; i < matches.length; i++) {
            var symbol = matches[i].trim().replace(/^!/, "")
            if (symbol in ["and", "or"] || symbol in symbols) continue
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

        return null
    }

    return new Circular()
})()