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
        document.addEventListener("DOMContentLoaded", this.init)
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
            var klass = this.controllers[name]
            elements[i]._controller = new klass()
            Controller.call(elements[i]._controller, elements[i])
        }

        // initialize all bindings
        ContentBinding.setup()
    }

    Circular.prototype.controller = function(name, klass) {
        this.controllers[name] = klass
    }

    /*============= Controller =======================================================================================*/

    function Controller(element) {
        this.element = element
        this.context = new Context()
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
            var p = new Property(property, this[property])
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
            throw new Error("Property '" + property + "' not defined in this contex")
        }
    }

    Circular.Context = Context

    /*============= Property =========================================================================================*/

    function Property(name, initialValue) {
        this.name = name
        this.value = initialValue
        this.bindings = []
    }

    Property.prototype.addBinding = function(binding) {
        this.bindings.push(binding)
    }

    Property.prototype.updateBindings = function(oldValue, newValue) {
        for (var i = 0; i < this.bindings.length; i++) {
            this.bindings[i].update(oldValue, newValue)
        }
    }

    Property.prototype.getValue = function() {
        return this.value
    }

    Property.prototype.setValue = function(value) {
        var oldValue = this.value
        this.value = value

        if (oldValue != value) {
            this.updateBindings(oldValue, value)
        }
    }

    /*============= Bindings =========================================================================================*/

    function Binding() {

    }

    Binding.prototype.update = function(oldValue, newValue) {
        // is called when the property value was changed
    }

    /**
     * Attaches this binding to the nearest controller.
     */
    Binding.prototype.attach = function() {
        // TODO: implement
    }

    //--

    /**
     * Binds the content of an HTML element to a property
     * @param element DOMElement
     * @constructor
     */
    function ContentBinding(element) {
        Binding.call(this)
        this.element = element
    }
    ContentBinding.prototype = new Binding()
    Circular.ContentBinding = ContentBinding

    ContentBinding.prototype.update = function(oldValue, newValue) {
        this.element.innerHTML = newValue
    }

    /**
     * Searches for content binding declarations and sets up the bindings.
     */
    ContentBinding.setup = function() {
        var decls = document.querySelectorAll("*[bind-content]")
        for (var i = 0; i < decls.length; i++) {
            var exprText = decls[i].getAttribute("bind-content")
            var expr = new BindingExpression(exprText)
        }
    }

    //--

    /*============= Binding expressions ==============================================================================*/

    function BindingExpression(str) {

    }

    return Circular
})()