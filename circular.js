/**
 * circular.js
 *
 */

var Circular = (function() {
    function Circular() {

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

    //--

    function ContentBinding(element) {
        Binding.call(this)
        this.element = element
    }
    ContentBinding.prototype = new Binding()
    Circular.ContentBinding = ContentBinding

    ContentBinding.prototype.update = function(oldValue, newValue) {
        this.element.innerHTML = newValue
    }


    return Circular
})()