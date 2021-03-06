 pv.Behavior.dragBase = function(shared){
    var events, // event registrations held during each selection
        downElem,
        cancelClick,
        inited,
        drag;

    shared.autoRender = true;
    shared.positionConstraint = null;
    shared.bound = function(v, a_p) {
        return Math.max(drag.min[a_p], Math.min(drag.max[a_p], v));
    };

    /** @private protovis mark event handler */
    function mousedown(d) {
        // Initialize
        if(!inited){
            inited = true;
            this.addEventInterceptor('click', eventInterceptor, /*before*/true);
        }

        // Add event handlers to follow the drag.
        // These are unregistered on mouse up.
        if(!events){
            var root = this.root.scene.$g;
            events = [
                // Attaching events to the canvas (instead of only to the document)
                // allows canceling the bubbling of the events before they
                // reach the handlers of ascendant elements (of canvas).
                [root,     'mousemove', pv.listen(root, 'mousemove', mousemove)],
                [root,     'mouseup',   pv.listen(root, 'mouseup',   mouseup  )],

                // It is still necessary to receive events
                // that are sourced outside the canvas
                [document, 'mousemove', pv.listen(document, 'mousemove', mousemove)],
                [document, 'mouseup',   pv.listen(document, 'mouseup',   mouseup  )]
            ];
        }

        var ev = arguments[arguments.length - 1]; // last argument
        downElem = ev.target;
        cancelClick = false;

        // Prevent the event from bubbling off the canvas
        // (if being handled by the root)
        ev.stopPropagation();

        // --------------

        var m1    = this.mouse();
        var scene = this.scene;
        var index = this.index;

        drag =
        scene[index].drag = {
            phase: 'start',
            m:     m1,    // current relevant mouse position
            m1:    m1,    // the mouse position of the mousedown
            m2:    null,  // the mouse position of the current/last mousemove
            d:     d,     // the datum in mousedown
            scene: scene, // scene context
            index: index  // scene index
        };

        ev = wrapEvent(ev, drag);

        shared.dragstart.call(this, ev);

        var m = drag.m;
        if(m !== m1){
            m1.x = m.x;
            m1.y = m.y;
        }
    }

    /** @private DOM event handler */
    function mousemove(ev) {
        if (!drag) { return; }

        drag.phase = 'move';

        // Prevent the event from bubbling off the canvas
        // (if being handled by the root)
        ev.stopPropagation();

        ev = wrapEvent(ev, drag);

        // In the context of the mousedown scene
        var scene = drag.scene;
        scene.mark.context(scene, drag.index, function() {
            // this === scene.mark
            var mprev = drag.m2 || drag.m1;

            var m2 = this.mouse();
            if(mprev && m2.distance2(mprev).dist2 <= 2){
                return;
            }

            drag.m = drag.m2 = m2;

            shared.drag.call(this, ev);

            // m2 may have changed
            var m = drag.m;
            if(m !== m2){
                m2.x = m.x;
                m2.y = m.y;
            }
        });
    }

    /** @private DOM event handler */
    function mouseup(ev) {
        if (!drag) { return; }

        drag.phase = 'end';

        var m2 = drag.m2;

        // A click event is generated whenever
        // the element where the mouse goes down
        // is the same element of where the mouse goes up.
        // We will try to intercept the generated click event and swallow it,
        // when some selection has occurred.
        var isDrag = m2 && drag.m1.distance2(m2).dist2 > 0.1;
        drag.canceled = !isDrag;

        cancelClick = isDrag && (downElem === ev.target);
        if(!cancelClick){
            downElem = null;
        }

        // Prevent the event from bubbling off the canvas
        // (if being handled by the root)
        ev.stopPropagation();

        ev = wrapEvent(ev, drag);

        // Unregister events
        if(events){
            events.forEach(function(registration){
                pv.unlisten.apply(pv, registration);
            });
            events = null;
        }

        var scene = drag.scene;
        var index = drag.index;
        try{
            scene.mark.context(scene, index, function() {
                shared.dragend.call(this, ev);
            });
        } finally {
            drag = null;
            delete scene[index].drag;
        }
    }

    function wrapEvent(ev, drag) {
        try {
            ev.drag = drag;
            return ev;
        } catch(ex) {
            // SWALLOW
        }

        // wrap
        var ev2 = {};
        for(var p in ev) {
            var v = ev[p];
            ev2[p] = typeof v !== 'function' ? v : bindEventFun(v, ev);
        }

        ev2._sourceEvent = ev;

        return ev2;
    }

    function bindEventFun(f, ctx) {
        return function() { return f.apply(ctx, arguments); };
    }

    /**
     * Intercepts click events and,
     * if they were consequence
     * of a mouse down and up of a selection,
     * cancels them.
     *
     * @returns {boolean|array}
     * <tt>false</tt> to indicate that the event is handled,
     * otherwise, an event handler info array: [handler, type, scenes, index, ev].
     *
     * @private
     */
    function eventInterceptor(type, ev){
        if(cancelClick && downElem === ev.target){
            // Event is handled
            cancelClick = false;
            downElem = null;
            return false;
        }

        // Let event be handled normally
    }


    /**
     * Whether to automatically render the mark when appropriate.
     *
     * @function
     * @returns {pv.Behavior.dragBase | boolean} this, or the current autoRender parameter.
     * @name pv.Behavior.dragBase.prototype.autoRender
     * @param {string} [_] the new autoRender parameter
     */
    mousedown.autoRender = function(_) {
        if (arguments.length) {
            shared.autoRender = !!_;
            return mousedown;
        }

        return shared.autoRender;
    };

    /**
     * Gets or sets the positionConstraint parameter.
     *
     * A function that given a drag object
     * can change its property <tt>m</tt>,
     * containing a vector with the desired mouse position.
     *
     * @function
     * @name pv.Behavior.dragBase.prototype.positionConstraint
     * @param {Function} [_] the new positionConstraint parameter
     * @return {pv.Behavior.dragBase | Function} this, or the current positionConstraint parameter.
     */
    mousedown.positionConstraint = function(_) {
        if (arguments.length) {
            shared.positionConstraint = _;
            return mousedown;
        }

        return shared.positionConstraint;
    };

    return mousedown;
};

