// constants to use throughout the program
const IdentityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])


/** Compile and link the vertex and fragment shaders */ 
function compileAndLinkGLSL(vs_source, fs_source) {
    // compile the vertex shader
    let vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, vs_source)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vs))
        throw Error("Vertex shader compilation failed")
    }
    // compile the fragment shader
    let fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, fs_source)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fs))
        throw Error("Fragment shader compilation failed")
    }  
    // link the shaders in one program
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
        throw Error("Linking failed")
    }
    // return the program
    return program
}


/** Sends per-vertex data to the GPU and connects it to a VS input */
function supplyDataBuffer(data, program, vsIn, mode) {
    if (mode === undefined) mode = gl.STATIC_DRAW
    let buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    let f32 = new Float32Array(data.flat())
    gl.bufferData(gl.ARRAY_BUFFER, f32, mode)
    let loc = gl.getAttribLocation(program, vsIn)
    gl.vertexAttribPointer(loc, data[0].length, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(loc)
    return buf;
}


/** Creates a Vertex Array Object and puts into it all of the data in the given */
function setupGeometry(geom, program) {
    var triangleArray = gl.createVertexArray()
    gl.bindVertexArray(triangleArray)
    for(let name in geom.attributes) {
        let data = geom.attributes[name]
        supplyDataBuffer(data, program, name)
    }
    var indices = new Uint16Array(geom.triangles.flat())
    var indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
    return {
        mode: gl.TRIANGLES,
        count: indices.length,
        type: gl.UNSIGNED_SHORT,
        vao: triangleArray
    }
}


// add initial velocity and accerlation to the sphere geometry
function addProperties(sphere){
    // properties to add to the geometry
    sphere.attributes.acceleration = []
    sphere.attributes.velocity = []
    sphere.attributes.color = []
    sphere.scaledRadius = []
    sphere.center = []
    sphere.mass = []

    // values used to calculate new properties
    let acc = 9.80665
    let velX = Math.random()*10 - 10
    let velY = Math.random()*10 - 10
    let velZ = Math.random()*10 - 10
    let posScaled = Math.random() * (0.1-0.03) + 0.03
    let r = Math.random()
    let g = Math.random()
    let b = Math.random()
    let x = Math.random() - (posScaled * 2) - 0.5
    let y = Math.random() - (posScaled * 2) - 0.5
    let z = Math.random()/2 - (posScaled * 2)
    let xmin = 0
    let centerY = 0
    let centerZ = 0

    // loop through the geometry and add the new properties
    for (let i=0; i < sphere.attributes.position.length; i+=1){
        sphere.attributes.acceleration.push([0, 0, -acc])
        sphere.attributes.velocity.push([velX,velY,velZ])
        sphere.attributes.color.push([r,g,b])

        let newX = (sphere.attributes.position[i][0] * posScaled) + x
        let newY = (sphere.attributes.position[i][1] * posScaled) + y
        let newZ = (sphere.attributes.position[i][2] * posScaled) + z

        sphere.attributes.position[i] = [newX, newY, newZ]
    }

    for (let i=0; i < sphere.attributes.position.length; i+=1){
        // this will help to figure out the new center of the sphere
        if (sphere.attributes.position[i][0] < xmin){
            xmin = sphere.attributes.position[i][0]
            centerY = sphere.attributes.position[i][1]
            centerZ = sphere.attributes.position[i][2]
        }
    }

    // add how much the shpere/radius has been scaled down from the original size
    sphere.scaledRadius.push(posScaled)
    // add new center to use in sphere collision detection
    sphere.center.push([xmin+posScaled, centerY,centerZ])
    // add mass based on scaling factor
    sphere.mass.push(10*posScaled)
}


// function to detect sphere to sphere collisions
function collision(sphereList, deltaT, dragT){
    var deltaT = deltaT
    var dragT = dragT

    for (let r=0; r<sphereList.length-1; r +=1){
        var elastic = 0.5
        var sphere1 = sphereList[r]

        for (let i=r+1; i<sphereList.length; i+=1){
            let sphere2 = sphereList[i]
            let center1 = sphere1.center[0]
            let center2 = sphere2.center[0]
            let distance = Math.sqrt(Math.pow(center2[0]-center1[0],2) + Math.pow(center2[1]-center1[1],2) + Math.pow(center2[2]-center1[2],2))

            let relVel = sub(sphere2.attributes.velocity[0], sphere1.attributes.velocity[0])
            let centerVec = normalize(sub(center2, center1))
            let direction = dot(relVel, centerVec)

            if (distance <= sphere1.scaledRadius[0] + sphere2.scaledRadius[0] && direction < 0){
                console.log('collision detected!')
                let mass1 = sphere1.mass[0]
                let mass2 = sphere2.mass[0]
                let weight1 = mass2 / (mass1 + mass2)
                let weight2 = mass1 / (mass1 + mass2)
                let centerDir = sub(sphere2.center[0], sphere1.center[0])
                let collDir = normalize(centerDir)
                let speed1 = dot(sphere1.attributes.velocity[0], collDir)
                let speed2 = dot(sphere2.attributes.velocity[0], collDir)
                let netSpeed = speed2 - speed1
                var fix1 = weight1 * (1 + elastic) * netSpeed
                var fix2 = -weight2 * (1 + elastic) * netSpeed

                for (let j=0; j<sphere1.attributes.position.length; j+=1){
                    sphere1.attributes.velocity[j] = add(sphere1.attributes.velocity[j], mul(collDir, fix1))
                    sphere1.attributes.position[j] = add(sphere1.attributes.position[j], mul(sphere1.attributes.velocity[j], deltaT))
                }
                sphere1.center[0] = add(sphere1.center[0], mul(sphere1.attributes.velocity[0], deltaT))

                for (let j=0; j<sphere2.attributes.position.length; j+=1){
                    sphere2.attributes.velocity[j] = add(sphere2.attributes.velocity[j], mul(collDir, fix2))
                    sphere2.attributes.position[j] = add(sphere2.attributes.position[j], mul(sphere2.attributes.velocity[j], deltaT))
                }
                sphere2.center[0] = add(sphere2.center[0], mul(sphere2.attributes.velocity[0], deltaT))
            }
        }
    }
}


// function to move the spheres and update velocity
function moveSphere(sphereList){
    for (let j=0; j < sphereList.length; j+=1){
        var sphere = sphereList[j]
        var hitCheck = 0
        var deltaT = 0.018
        let drag = Math.random()
        var dragT = Math.pow(drag, deltaT)
        let scale = sphere.scaledRadius[0]
        let distance = 0
        
        // acceleration will not change, velocity and position will
        for (let i=0; i < sphere.attributes.position.length; i+=1){
            let newVel = add(mul(sphere.attributes.velocity[i], dragT), mul(sphere.attributes.acceleration[i], deltaT))
            let newPos = add(sphere.attributes.position[i], mul(sphere.attributes.velocity[i], deltaT))

            sphere.attributes.position[i] = newPos
            sphere.attributes.velocity[i] = newVel

            if (newPos[0] + scale < -1 || newPos[1] + scale < -1 || newPos[2] + scale < -1 || newPos[0] - scale > 1 || newPos[1] - scale > 1 || newPos[2] - scale > 1){
                hitCheck += 1
            }
        }
        distance = sub(add(sphere.center[0], mul(sphere.attributes.velocity[0], deltaT)), sphere.center[0])
        sphere.center[0] = add(sphere.center[0], mul(sphere.attributes.velocity[0], deltaT))

        //reverse velocity if sphere hits a wall
        if (hitCheck > 0){
            for (let k=0; k < sphere.attributes.position.length; k+=1){
                sphere.attributes.velocity[k] = add(mul(mul(sphere.attributes.velocity[k], dragT), -1), mul(sphere.attributes.acceleration[k], deltaT))
                sphere.attributes.position[k] = add(sphere.attributes.position[k], mul(sphere.attributes.velocity[k], deltaT))
            }
            distance = sub(add(sphere.center[0], mul(sphere.attributes.velocity[0], deltaT)), sphere.center[0])
            sphere.center[0] = add(sphere.center[0], mul(sphere.attributes.velocity[0], deltaT))
        }

        if (distance < 0.001){
            for (let k=0; k < sphere.attributes.position.length; k+=1){
                sphere.attributes.velocity[k] = [0,0,0]
                sphere.attributes.position[k] = add(sphere.attributes.position[k], mul(sphere.attributes.velocity[k], deltaT))
            }
            distance = sub(add(sphere.center[0], mul(sphere.attributes.velocity[0], deltaT)), sphere.center[0])
            sphere.center[0] = add(sphere.center[0], mul(sphere.attributes.velocity[0], deltaT))
        }
    }
    collision(sphereList, deltaT, dragT)
}


/** Draw the required spheres */
function drawReq() {
    gl.clearColor(0.25,0.25,0.25,1.0) // f(...[1,2,3]) means f(1,2,3)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    
    let lightdir = normalize([0,0,1])
    let halfway = normalize(add(lightdir, [0,0,1]))

    // lambert light
    gl.uniform3fv(gl.getUniformLocation(program1, 'lam_lightdir'), lightdir)
    // blinn phong light
    gl.uniform3fv(gl.getUniformLocation(program1, 'bp_halfway'), halfway)
    // light color
    gl.uniform3fv(gl.getUniformLocation(program1, 'lightcolor'), [1,1,1])

    gl.uniformMatrix4fv(gl.getUniformLocation(program1, 'mv'), false, m4mult(v,m))
    gl.uniformMatrix4fv(gl.getUniformLocation(program1, 'p'), false, p)
    
    //draw program1
    gl.useProgram(program1)

    for (let i=0; i<geomList.length; i+=1){
        gl.bindVertexArray(geomList[i].vao)
        gl.drawElements(geomList[i].mode, geomList[i].count, geomList[i].type, 0)
    }
}

window.oldTime = 0
window.fps = 0

/** Compute any time-varying or animated aspects of the scene */
function timeStep() {
    const deltaTime = performance.now()-oldTime
    oldTime = performance.now()
    fps = (1000/deltaTime).toFixed(2)

    window.camera = [2, 2, 0]
    window.center = [0,0,0]
    window.up = [0,0,1]
    window.m = IdentityMatrix
    window.v = m4view(camera, center, up)
    
    moveSphere(sphereList)

    window.geomList = []
    for (let i=0; i<sphereList.length; i+=1){
        window.geomSphere = setupGeometry(sphereList[i], program1)
        geomList.push(geomSphere)
    }

    drawReq()
    window.pending = requestAnimationFrame(timeStep)

    document.querySelector('#fps').innerHTML = "Frames Per Second: " + fps 
}


/** Resizes the canvas to completely fill the screen */
function fillScreen() {
    let canvas = document.querySelector('canvas')
    document.body.style.margin = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    canvas.style.width = ''
    canvas.style.height = ''

    if (window.gl) {
        gl.viewport(0,0, canvas.width, canvas.height)
        window.p = m4perspNegZ(0.05, 5, 1, canvas.width, canvas.height)
    }
}


/** Compile, link, other option-independent setup */
async function setup(event) {
    window.gl = document.querySelector('canvas').getContext('webgl2',
        {antialias: false, depth:true, preserveDrawingBuffer:true}
    )

    // create program for the spheres
    let vs1 = await fetch('vertexShader.glsl').then(res => res.text())
    let fs1 = await fetch('fragmentShader.glsl').then(res => res.text())
    window.program1 = compileAndLinkGLSL(vs1,fs1)

    window.sphereList = []

    // fetch the geometry data for the sphere object
    for (let i=0; i<50; i+=1){
        let ball = await fetch('sphere80.json').then(r=>r.json())
        addProperties(ball)
        window.sphereList.push(ball)
    }

    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    
    cancelAnimationFrame(window.pending)
    fillScreen()
    window.addEventListener('resize', fillScreen)
    timeStep(sphereList)
}


// change number of spheres for optional part
async function setupScene(scene, options) {
    if (scene == "burst"){
        cancelAnimationFrame(window.pending)

        // get the number of spheres
        var balls = options["particles"]

        // render the geometry
        window.sphereList = []

        // fetch the geometry data for the sphere object
        for (let i=0; i<balls; i+=1){
            let ballX = await fetch('sphere80.json').then(r=>r.json())
            addProperties(ballX)
            window.sphereList.push(ballX)
        }

        fillScreen()
        window.addEventListener('resize', fillScreen)
        timeStep(sphereList)
    }
}


window.addEventListener('load',setupScene)
window.addEventListener('load',setup)

interval = setInterval(setup, 15000)