/*
 * simulation.js
 * 
 * Author:
 *     George Lesica <george@lesica.com>
 * Description:
 *     Core simulation and rendering classes.
 */

/*
 * TODO - Interface
 * Add a Player class that will handle the interface (more or less a "view").
 * It will create a Simulation object and then handle adding the renderer to
 * the div along with creating buttons for interaction. It will proxy button
 * clicks to the appropriate methods on the Simulation object that it owns.
 *
 * TODO - Bounding box
 * Add a wireframe box around the extents of the simulation to help with
 * perspective perception.
 *
 * TODO - Camera handling
 * Use the zoom multiplier to implement functions that change the camera
 * distance relative to the point it is looking at. Just multiply the position
 * vector by the zoom value on each draw.
 */

PV = {};

PV.defaults = {
    width       : 800.0,
    height      : 600.0,
    aspectRatio : 800.0 / 600.0,
    viewAngle   : 45,
    nearPlane   : 0.1,
    farPlane    : 100.0,
    cameraZ     : 10.0
};

PV.Simulation = function(createOn) {

	$el = $('#'+createOn);

    // TODO: Fallback to canvas for non-WebGL browsers
    this._renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    this._renderer.setSize(800, 600);

    // TODO: Ortho camera might be desireable as an option for 2d sims
    this._camera = new THREE.PerspectiveCamera(
        PV.defaults.viewAngle,
        PV.defaults.aspectRatio,
        PV.defaults.nearPlane,
        PV.defaults.farPlane
    );
    
    this._scene = new THREE.Scene();
    this._scene.add(this._camera);

    this._draw = function() {
        this._renderer.render(this._scene, this._camera);
    };

    this._origin = new THREE.Vector3(0, 0, 0);

    // Bookkeeping
    // TODO: Move this stuff to reset method
    this.playing = false;
    this.forward = true;
    this.speed = 1;
    this.wireframe = true;
    this.zoom = 1.0 // scalar multiplier for camera position

    // Get ready to store some particle data
    // TODO: Move this stuff to reset method
    this.particles = {};
    this.states = [];
    this.tick = 0;

    // Set up the interface
    $el.append(this._renderer.domElement);
    var $menu = $('<div class="pv-menu"></div>').appendTo($el);
	
	this.progressBar.init(this, $el);
	
	$menu.append('<div class="pv-playforward">Play</div>');
	$menu.append('<div class="pv-playbackward">Reverse</div>');
	$menu.append('<div class="pv-pause">Pause</div>');
	$menu.append('<div class="pv-stop">Stop</div>');
	$menu.append('<div class="pv-load">Load</div>');
    $menu.append('<select id="pv-cam">');
    
    var sim = this;
    $.getJSON('../demo/menulist.json', function(data) {
        sim.simsList = data;
        var $dropdown = $('<select id="pv-simchoice">');
        for (i in data) {
            var choice = $('<option value="' + data[i] + '">' + data[i] + '</option>');
            choice.appendTo($dropdown);
        }
        $menu.append($dropdown);
    });

    var $btnPlayForward = $('.pv-playforward')
        .click(function() {
            sim.playForward();
        });
    var $btnPlayBackward = $('.pv-playbackward')
        .click(function() {
            sim.playBackward();
        });
    var $btnPause = $('.pv-pause')
        .click(function() {
            sim.pause();
        });
    var $btnStop = $('.pv-stop')
        .click(function() {
            sim.stop();
        });
    var $btnReload = $('.pv-load')
        .click(function() {
            sim.reset();
            //sim.loadFromJSON($('#sim-data').val());
            var simChoice = $('#pv-simchoice').val();
            sim.loadFromRemoteJSON('../demo/' + simChoice);
            console.log('Loading "../demo/' + simChoice + '"');
        });
    
    $('#pv-cam')
        .append('<option value="upper-right">Upper Right</option>')
        .append('<option value="front">Front View</option>')
        .change(function() {
            sim.setCameraView($(this).val());
        });

	return this;
};

/*
 * Resets the simulation, clearing the bounding box, states, particles and
 * resetting the tick.
 * TODO: Reset more stuff that can be changed. Probably just call this on init.
 */
PV.Simulation.prototype.reset = function() {
    this.stop();
    // Remove particles from scene
    for (id in this.particles) {
        if (this.particles.hasOwnProperty(id)) {
            // FIXME: This next line should work... using hack instead
            //this.particles[id].remove();
            this._scene.__removeObject(this.particles[id]);
        }
    }
    // Remove the bounding box from the scene
    if (this.boundingBox !== undefined) {
        // FIXME: Should work...
        //this.boundingBox.remove();
        this._scene.__removeObject(this.boundingBox);
    }
    // Reset containers
    this.particles = {};
    this.states = [];
    this.tick = 0;
};

/* 
 * Set visualization to a particular tick.
 */
PV.Simulation.prototype.setTick = function(t) {
    this.tick = t;
    var state = this.states[t];
    for (id in state) {
        if (state.hasOwnProperty(id)) {
            this.updateParticle(id, state[id]);
        }
    }
    this._draw();
};

/*
 * Advance the visualization by one tick.
 */
PV.Simulation.prototype.tickForward = function(n) {
    var ticks = n || 1;
    if (this.tick < this.states.length - 1) {
        this.setTick(this.tick + ticks);
    }
};

/*
 * Back up the visualization by one tick.
 */
PV.Simulation.prototype.tickBackward = function(n) {
    var ticks = n || 1;
    if (this.tick > 0) {
        this.setTick(this.tick - ticks);
    }
};

/*
 * Add a new state (time step) for a particular particle.
 * `id`   : particle id
 * `t`    : time step for this state (int)
 * `prop` : properties object
 */
PV.Simulation.prototype.addParticleState = function(id, t, prop) {
    // Check if this t already has some states
    if (this.states[t] === undefined) {
        this.states[t] = {};
    }
    // Add state data
    this.states[t][id] = {
        x: prop.x,
        y: prop.y,
        z: prop.z,
        r: prop.r
    };
};

/*
 * Add a new particle to the simulation.
 * `id`   : particle id, must be unique within the simulation
 * `prop` : initial properties for the particle
 */
PV.Simulation.prototype.addParticle = function(id, prop) {
    console.log('Adding particle: ', prop);
    // Check for dups
    if (this.particles.hasOwnProperty(id)) {
        console.error('Overwriting particle with duplicate ID');
    }
    // Add the particle
    this.particles[id] = new THREE.Mesh(
        new THREE.SphereGeometry(prop.r, 20),
        new THREE.MeshBasicMaterial({
            //color: 0x00ff00,
            color: Math.random() * 10000000 + 6777215,
            wireframe: this.wireframe
        })
    );
    this.particles[id].position = new THREE.Vector3(prop.x, prop.y, prop.z);
    this._scene.add(this.particles[id]);
};

/*
 * Update the properties of a particle. Omitted properties are not changed.
 * `id`   : id of particle to update
 * `prop` : new property values for the particle
 */
PV.Simulation.prototype.updateParticle = function(id, prop) {
    this.particles[id].position.set(prop.x, prop.y, prop.z);
};

/*
 * Load a simulation from a JS object.
 * `sim`: simulation data
 */
PV.Simulation.prototype.loadFromObject = function(data) {
    // Add all states
    for (i in data.states) {
        var state = data.states[i];
        this.addParticleState(state.id, state.t, state);
    }
    // Set initial conditions from first timestep
    var state = this.states[0];
    for (id in state) {
        if (state.hasOwnProperty(id)) {
            this.addParticle(id, state[id]);
        }
    }
    this.setBoundingBox();
    this._draw();
	this.progressBar.load(this.states.length);
};

/*
 * Load a simulation from a JSON string.
 * `sim`: JSON string with simulation data
 */
PV.Simulation.prototype.loadFromJSON = function(data) {
    this.loadFromObject($.parseJSON(data));
};

/*
 * Load a simulation from a remote JSON string using an AJAX request.
 * 'url': URL of the JSON data to load
 */
PV.Simulation.prototype.loadFromRemoteJSON = function(url) {
    var sim = this;
    $.getJSON(url, function(data) {
        sim.loadFromObject(data);
    });
};

/*
 * Allow the simulation to play forward.
 */
PV.Simulation.prototype.playForward = function() {
    this.forward = true;
    this.playing = true;
};

/*
 * Allow the simulation to play backward.
 */
PV.Simulation.prototype.playBackward = function() {
    this.forward= false;
    this.playing = true;
}

/*
 * Stop the simulation from playing temporarily.
 */
PV.Simulation.prototype.pause = function() {
    this.playing = false;
};

/*
 * Stop the simulation from playing and return to t=0.
 */
PV.Simulation.prototype.stop = function() {
    this.playing = false;
    this.forward = true;
    this.setTick(0);
	this.progressBar.stop();
};

/*
 * Set wireframe on or off (true or false).
 */
PV.Simulation.prototype.setWireframe = function(state) {
    this.wireframe = state;
};

/*
 * Turn wireframe on.
 */
PV.Simulation.prototype.enableWireframe = function() {
    this.setWireframe(true);
};

/*
 * Turn wireframe off.
 */
PV.Simulation.prototype.disableWireframe = function() {
    this.setWireframe(false);
};

/*
 * Computes and creates the bounding box dimensions and location. This also
 * sets the camera to a reasonable location since we need to know about the
 * bounding box in order to do that.
 * TODO: Set the location since it might not always be the origin.
 */
PV.Simulation.prototype.setBoundingBox = function() {
    // Compute max and min x, y, and z values
    var minX = 0;
    var maxX = 0;
    var minY = 0;
    var maxY = 0;
    var minZ = 0;
    var maxZ = 0;

    for (t in this.states) {
        var state = this.states[t];
        for (id in state) {
            if (state.hasOwnProperty(id)) {
                var particle = state[id];
                minX = Math.min(particle.x, minX);
                maxX = Math.max(particle.x, maxX);
                minY = Math.min(particle.y, minY);
                maxY = Math.max(particle.y, maxY);
                minZ = Math.min(particle.z, minZ);
                maxZ = Math.max(particle.z, maxZ);
            }
        }
    }

    this.boundingBox = new THREE.Mesh(
        new THREE.CubeGeometry(maxX - minX + 2, maxY - minY + 2, maxZ - minZ + 2, 1, 1, 1),
        new THREE.MeshBasicMaterial({
            color: 0x00bbff,
            wireframe: true
        })
    );
    this._scene.add(this.boundingBox);

    // Record the extents for setting camera later
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    this.minZ = minZ;
    this.maxZ = maxZ;

    this.sizeX = maxX - minX;
    this.sizeY = maxY - minY;
    this.sizeZ = maxZ - minZ;

    // Set the camera to something sane
    this._origin.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    this.setCameraView('upper-right');
};

/*
 * Set camera to a predefined location.
 */
PV.Simulation.prototype.setCameraView = function(view) {
    switch (view) {
        case 'upper-right':
            this._camera.position.set(this.maxX + 6, this.maxY + 6, this.maxZ + 11);
            break;
        case 'front':
            var dim = Math.max(this.sizeX, this.sizeY);
            this._camera.position.set(0, 0, dim / Math.tan(Math.PI / 8));
            break;
    }
    this._camera.lookAt(this._origin);
};

/*
 * Start the visualization running. This should be done after everything has
 * been initialized.
 */
PV.Simulation.prototype.run = function() {
    var sim = this;
    function animate() {
        requestAnimationFrame(animate);
        if (sim.playing) {
            if (sim.forward === true) {
                sim.tickForward(sim.speed);
				sim.progressBar.tickForward();
            } else {
                sim.tickBackward(sim.speed);
				sim.progressBar.tickBackward();
            }
        }
    }
    animate();
    return this;
}

/*
* Object for the progress bar
*/
PV.Simulation.prototype.progressBar = {	
	
	/*
	*  Initialization function for the progress bar
	*/
	init:function(simulation, $el){
		this.sim = simulation;
		this.$progressContainer = $('<div id="pv-progressbarcontainer"></div>').appendTo($el);
		this.$progressBar = $('<div id="pv-progressbar"></div>').appendTo(this.$progressContainer);
		this.setClick();
	},
	
	/*
	*	Sets the necessary amounts for when a particular file is loaded
	*/
	load:function(amountOfStates){
		this._resetProgressBar();
		this.maxWidth = this.$progressContainer.css('width').replace("px", "");
		this.stepAmount = this.maxWidth / amountOfStates;
	},
	
	/*
	* Binds clicking on the progress bar
	*/
	setClick:function(){
		var self = this;
		this.$progressContainer.click(function(e){
			var offset = $(this).offset();
			self.handleClick(e.clientX - offset.left);
		});
	},
	
	/*
	* Handles clicking on the progress bar
	*/
	handleClick:function(x){
		if(sim.states !== undefined && sim.states.length > 0){
			this.sim.setTick(Math.floor((x/this.maxWidth)*sim.states.length));
			this.progressBarWidth = x;
			this._setProgressBar(x);
		}
	},
	
	/*
	* Ticks the progress bar forward
	*/
	tickForward:function(){
		if(this.progressBarWidth < this.maxWidth){		
			this.progressBarWidth += this.stepAmount;
			this._setProgressBar(this.progressBarWidth);
		}
	},
	
	/*
	* Ticks the progress bar backwards
	*/
	tickBackward:function(){
		if(this.progressBarWidth > 0){		
			this.progressBarWidth -= this.stepAmount;
			this._setProgressBar(this.progressBarWidth);
		}
	},
	
	/*
	* Stops the progress bar - basically a reset
	*/
	stop:function(){
		this._resetProgressBar();
	},
	
	/*
	*	Sets the width of the progressbar
	*/
	_setProgressBar:function(width){
		this.$progressBar.css('width', width);
	},
	
	/*
	* Resets the progress bar
	*/
	_resetProgressBar:function(){
		this.progressBarWidth = 0;
		this._setProgressBar(this.progressBarWidth);
	}
}






