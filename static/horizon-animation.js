// Horizon Animation - Three.js Implementation
// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Global references
const threeRefs = {
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    stars: [],
    nebula: null,
    mountains: [],
    locations: [],
    animationId: null,
    targetCameraX: 0,
    targetCameraY: 30,
    targetCameraZ: 100
};

const smoothCameraPos = { x: 0, y: 30, z: 100 };
let scrollProgress = 0;
let currentSection = 0;
const totalSections = 2;
let isReady = false;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initThree();
    setupScrollHandling();
});

function initThree() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }

    // Scene setup
    threeRefs.scene = new THREE.Scene();
    threeRefs.scene.fog = new THREE.FogExp2(0x000000, 0.00025);

    // Camera
    threeRefs.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    threeRefs.camera.position.z = 100;
    threeRefs.camera.position.y = 20;

    // Renderer
    threeRefs.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    threeRefs.renderer.setSize(window.innerWidth, window.innerHeight);
    threeRefs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRefs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    threeRefs.renderer.toneMappingExposure = 0.5;

    // Post-processing
    threeRefs.composer = new THREE.EffectComposer(threeRefs.renderer);
    const renderPass = new THREE.RenderPass(threeRefs.scene, threeRefs.camera);
    threeRefs.composer.addPass(renderPass);

    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8,
        0.4,
        0.85
    );
    threeRefs.composer.addPass(bloomPass);

    // Create scene elements
    createStarField();
    createNebula();
    createMountains();
    createAtmosphere();
    getLocation();

    // Start animation
    animate();

    // Mark as ready
    isReady = true;
    setupGSAPAnimations();

    // Handle resize
    window.addEventListener('resize', handleResize);
}

function createStarField() {
    const starCount = 5000;

    for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let j = 0; j < starCount; j++) {
            const radius = 200 + Math.random() * 800;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);

            positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[j * 3 + 2] = radius * Math.cos(phi);

            // Color variation
            const color = new THREE.Color();
            const colorChoice = Math.random();
            if (colorChoice < 0.7) {
                color.setHSL(0, 0, 0.8 + Math.random() * 0.2);
            } else if (colorChoice < 0.9) {
                color.setHSL(0.08, 0.5, 0.8);
            } else {
                color.setHSL(0.6, 0.5, 0.8);
            }

            colors[j * 3] = color.r;
            colors[j * 3 + 1] = color.g;
            colors[j * 3 + 2] = color.b;

            sizes[j] = Math.random() * 2 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                depth: { value: i }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                uniform float time;
                uniform float depth;
                
                void main() {
                    vColor = color;
                    vec3 pos = position;
                    
                    float angle = time * 0.05 * (1.0 - depth * 0.3);
                    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                    pos.xy = rot * pos.xy;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
                    gl_FragColor = vec4(vColor, opacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const stars = new THREE.Points(geometry, material);
        threeRefs.scene.add(stars);
        threeRefs.stars.push(stars);
    }
}

function createNebula() {
    const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color1: { value: new THREE.Color(0x0033ff) },
            color2: { value: new THREE.Color(0xff0066) },
            opacity: { value: 0.3 }
        },
        vertexShader: `
            varying vec2 vUv;
            varying float vElevation;
            uniform float time;
            
            void main() {
                vUv = uv;
                vec3 pos = position;
                
                float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 20.0;
                pos.z += elevation;
                vElevation = elevation;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float opacity;
            uniform float time;
            varying vec2 vUv;
            varying float vElevation;
            
            void main() {
                float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
                vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);
                
                float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
                alpha *= 1.0 + vElevation * 0.01;
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const nebula = new THREE.Mesh(geometry, material);
    nebula.position.z = -1050;
    nebula.rotation.x = 0;
    threeRefs.scene.add(nebula);
    threeRefs.nebula = nebula;
}

function createMountains() {
    const layers = [
        { distance: -50, height: 60, color: 0x1a1a2e, opacity: 1 },
        { distance: -100, height: 80, color: 0x16213e, opacity: 0.8 },
        { distance: -150, height: 100, color: 0x0f3460, opacity: 0.6 },
        { distance: -200, height: 120, color: 0x0a4668, opacity: 0.4 }
    ];

    layers.forEach((layer, index) => {
        const points = [];
        const segments = 50;

        for (let i = 0; i <= segments; i++) {
            const x = (i / segments - 0.5) * 1000;
            const y = Math.sin(i * 0.1) * layer.height +
                Math.sin(i * 0.05) * layer.height * 0.5 +
                Math.random() * layer.height * 0.2 - 100;
            points.push(new THREE.Vector2(x, y));
        }

        points.push(new THREE.Vector2(5000, -300));
        points.push(new THREE.Vector2(-5000, -300));

        const shape = new THREE.Shape(points);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: layer.color,
            transparent: true,
            opacity: layer.opacity,
            side: THREE.DoubleSide
        });

        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.z = layer.distance;
        mountain.position.y = layer.distance;
        mountain.userData = { baseZ: layer.distance, index: index };

        threeRefs.scene.add(mountain);
        threeRefs.mountains.push(mountain);
    });
}

function createAtmosphere() {
    const geometry = new THREE.SphereGeometry(600, 32, 32);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;
                
                float pulse = sin(time * 2.0) * 0.1 + 0.9;
                atmosphere *= pulse;
                
                gl_FragColor = vec4(atmosphere, intensity * 0.25);
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    const atmosphere = new THREE.Mesh(geometry, material);
    threeRefs.scene.add(atmosphere);
}

function getLocation() {
    const locations = [];
    threeRefs.mountains.forEach((mountain, i) => {
        locations[i] = mountain.position.z;
    });
    threeRefs.locations = locations;
}

function animate() {
    threeRefs.animationId = requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Update stars
    threeRefs.stars.forEach((starField, i) => {
        if (starField.material.uniforms) {
            starField.material.uniforms.time.value = time;
        }
    });

    // Update nebula
    if (threeRefs.nebula && threeRefs.nebula.material.uniforms) {
        threeRefs.nebula.material.uniforms.time.value = time * 0.5;
    }

    // Smooth camera movement with easing
    if (threeRefs.camera) {
        const smoothingFactor = 0.05;

        smoothCameraPos.x += (threeRefs.targetCameraX - smoothCameraPos.x) * smoothingFactor;
        smoothCameraPos.y += (threeRefs.targetCameraY - smoothCameraPos.y) * smoothingFactor;
        smoothCameraPos.z += (threeRefs.targetCameraZ - smoothCameraPos.z) * smoothingFactor;

        const floatX = Math.sin(time * 0.1) * 2;
        const floatY = Math.cos(time * 0.15) * 1;

        threeRefs.camera.position.x = smoothCameraPos.x + floatX;
        threeRefs.camera.position.y = smoothCameraPos.y + floatY;
        threeRefs.camera.position.z = smoothCameraPos.z;
        threeRefs.camera.lookAt(0, 10, -600);
    }

    // Parallax mountains
    threeRefs.mountains.forEach((mountain, i) => {
        const parallaxFactor = 1 + i * 0.5;
        mountain.position.x = Math.sin(time * 0.1) * 2 * parallaxFactor;
        mountain.position.y = 50 + (Math.cos(time * 0.15) * 1 * parallaxFactor);
    });

    if (threeRefs.composer) {
        threeRefs.composer.render();
    }
}

function setupGSAPAnimations() {
    const menuEl = document.getElementById('sideMenu');
    const titleEl = document.getElementById('heroTitle');
    const subtitleEl = document.getElementById('heroSubtitle');
    const scrollProgressEl = document.getElementById('scrollProgress');

    // Set initial states
    gsap.set([menuEl, titleEl, subtitleEl, scrollProgressEl], {
        visibility: 'visible'
    });

    const tl = gsap.timeline();

    // Animate menu
    if (menuEl) {
        tl.from(menuEl, {
            x: -100,
            opacity: 0,
            duration: 1,
            ease: "power3.out"
        });
    }

    // Animate title
    if (titleEl) {
        tl.from(titleEl, {
            y: 200,
            opacity: 0,
            duration: 1.5,
            ease: "power4.out"
        }, "-=0.5");
    }

    // Animate subtitle lines
    if (subtitleEl) {
        const subtitleLines = subtitleEl.querySelectorAll('.subtitle-line');
        tl.from(subtitleLines, {
            y: 50,
            opacity: 0,
            duration: 1,
            stagger: 0.2,
            ease: "power3.out"
        }, "-=0.8");
    }

    // Animate scroll indicator
    if (scrollProgressEl) {
        tl.from(scrollProgressEl, {
            opacity: 0,
            y: 50,
            duration: 1,
            ease: "power2.out"
        }, "-=0.5");
    }
}

function setupScrollHandling() {
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Set initial position
}

function handleScroll() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const maxScroll = documentHeight - windowHeight;
    const progress = Math.min(scrollY / maxScroll, 1);

    scrollProgress = progress;
    const newSection = Math.floor(progress * totalSections);
    currentSection = newSection;

    // Update UI
    const progressFill = document.querySelector('.progress-fill');
    const currentSectionEl = document.getElementById('currentSection');

    if (progressFill) {
        progressFill.style.width = `${progress * 100}%`;
    }

    if (currentSectionEl) {
        currentSectionEl.textContent = String(currentSection).padStart(2, '0');
    }

    // Calculate camera positions
    const totalProgress = progress * totalSections;
    const sectionProgress = totalProgress % 1;

    const cameraPositions = [
        { x: 0, y: 30, z: 300 },
        { x: 0, y: 40, z: -50 },
        { x: 0, y: 50, z: -700 }
    ];

    const currentPos = cameraPositions[newSection] || cameraPositions[0];
    const nextPos = cameraPositions[newSection + 1] || currentPos;

    threeRefs.targetCameraX = currentPos.x + (nextPos.x - currentPos.x) * sectionProgress;
    threeRefs.targetCameraY = currentPos.y + (nextPos.y - currentPos.y) * sectionProgress;
    threeRefs.targetCameraZ = currentPos.z + (nextPos.z - currentPos.z) * sectionProgress;

    // Handle mountains
    threeRefs.mountains.forEach((mountain, i) => {
        const speed = 1 + i * 0.9;
        const targetZ = mountain.userData.baseZ + scrollY * speed * 0.5;

        if (threeRefs.nebula) {
            threeRefs.nebula.position.z = targetZ - 100 + progress * speed * 0.01;
        }

        mountain.userData.targetZ = targetZ;

        if (progress > 0.7) {
            mountain.position.z = 600000;
        } else {
            mountain.position.z = threeRefs.locations[i];
        }
    });

    if (threeRefs.nebula && threeRefs.mountains.length > 3) {
        threeRefs.nebula.position.z = threeRefs.mountains[3].position.z;
    }
}

function handleResize() {
    if (threeRefs.camera && threeRefs.renderer && threeRefs.composer) {
        threeRefs.camera.aspect = window.innerWidth / window.innerHeight;
        threeRefs.camera.updateProjectionMatrix();
        threeRefs.renderer.setSize(window.innerWidth, window.innerHeight);
        threeRefs.composer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (threeRefs.animationId) {
        cancelAnimationFrame(threeRefs.animationId);
    }

    threeRefs.stars.forEach(starField => {
        if (starField.geometry) starField.geometry.dispose();
        if (starField.material) starField.material.dispose();
    });

    threeRefs.mountains.forEach(mountain => {
        if (mountain.geometry) mountain.geometry.dispose();
        if (mountain.material) mountain.material.dispose();
    });

    if (threeRefs.nebula) {
        if (threeRefs.nebula.geometry) threeRefs.nebula.geometry.dispose();
        if (threeRefs.nebula.material) threeRefs.nebula.material.dispose();
    }

    if (threeRefs.renderer) {
        threeRefs.renderer.dispose();
    }
});