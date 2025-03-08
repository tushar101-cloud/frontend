// DOM Elements
const scene = document.querySelector('a-scene');
const arContent = document.querySelector('#ar-content');
const pathContainer = document.querySelector('#path-container');
const locationSelect = document.createElement('select');
locationSelect.id = 'location-select';
const locations = ['Seminar Hall', 'IBM Lab', 'SET Lab'];
locations.forEach(location => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    locationSelect.appendChild(option);
});
document.body.insertBefore(locationSelect, startBtn); // Insert the select before the start button

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const navInfo = document.getElementById('nav-info');

// Store camera stream reference
let currentStream = null;

// Navigation path and current position
let navigationPath = [];
let currentPosition = { x: 0, y: 0, z: 0 };
let markers = [];
let selectedLocation = null;

// 3D Arrow model for navigation
const ARROW_MODEL = {
    primitive: 'cone',
    height: 0.5,
    radiusBottom: 0.2,
    radiusTop: 0.01,
    segmentsHeight: 10,
    segmentsRadial: 16
};

async function loadModelAndPath() {
    let coordinates = [];
    try {
        const response = await fetch(`${backendUrl}/api/coordinates`); // Fetching coordinates from the backend
        const data = await response.json();
        coordinates = data.map(coord => ({
            x: coord.x,
            y: coord.y,
            z: coord.z,
            locationName: coord.locationName,
            description: coord.description,
            markerType: coord.markerType
        }));
        
        // Create markers for each location
        createLocationMarkers(coordinates);
        
        // Create navigation path
        navigationPath = coordinates;
        createNavigationPath();
    } catch (error) {
        console.error('Error fetching coordinates:', error);
        alert('Failed to load navigation path');
    }
}

function createLocationMarkers(locations) {
    // Clear existing markers
    markers.forEach(marker => marker.parentNode.removeChild(marker));
    markers = [];

    locations.forEach(location => {
        const marker = document.createElement('a-entity');
        marker.setAttribute('position', `${location.x} ${location.y} ${location.z}`);
        
        // Create marker base
        const base = document.createElement('a-sphere');
        base.setAttribute('radius', '0.2');
        base.setAttribute('color', location.markerType === 'DESTINATION' ? '#FF0000' : '#FFD700');
        base.setAttribute('material', 'opacity: 0.8');
        marker.appendChild(base);

        // Create location label
        const text = document.createElement('a-text');
        text.setAttribute('value', location.locationName);
        text.setAttribute('position', '0 0.3 0');
        text.setAttribute('align', 'center');
        text.setAttribute('color', '#FFFFFF');
        text.setAttribute('scale', '0.5 0.5 0.5');
        marker.appendChild(text);

        // Make marker clickable
        marker.classList.add('clickable');
        marker.addEventListener('click', () => {
            selectLocation(location);
        });

        pathContainer.appendChild(marker);
        markers.push(marker);
    });
}

function createNavigationPath() {
    if (!selectedLocation) return;

    pathContainer.innerHTML = '';
    const pathEntity = document.createElement('a-entity');
    pathEntity.setAttribute('id', 'navigation-path');

    // Create 3D arrows along the path
    navigationPath.forEach((point, index) => {
        const { x, y, z } = point;

        // Create waypoint marker
        const waypoint = document.createElement('a-sphere');
        waypoint.setAttribute('position', `${x} ${y} ${z}`);
        waypoint.setAttribute('radius', '0.1');
        waypoint.setAttribute('color', point.markerType === 'START' ? '#00ff00' : 
                                    point.markerType === 'DESTINATION' ? '#ff0000' : 
                                    '#ffff00');
        pathEntity.appendChild(waypoint);

        // Add location label
        if (point.locationName) {
            const text = document.createElement('a-text');
            text.setAttribute('value', point.locationName);
            text.setAttribute('position', `${x} ${y + 0.3} ${z}`);
            text.setAttribute('align', 'center');
            text.setAttribute('scale', '0.5 0.5 0.5');
            text.setAttribute('look-at', '[camera]');
            pathEntity.appendChild(text);
        }

        // Create arrow pointing to next point
        if (index < navigationPath.length - 1) {
            const nextPoint = navigationPath[index + 1];
            const arrow = document.createElement('a-entity');
            
            // Calculate direction vector
            const direction = {
                x: nextPoint.x - x,
                y: nextPoint.y - y,
                z: nextPoint.z - z
            };
            
            // Calculate distance to next point
            const distance = Math.sqrt(
                Math.pow(direction.x, 2) +
                Math.pow(direction.y, 2) +
                Math.pow(direction.z, 2)
            );

            // Create arrow
            arrow.setAttribute('geometry', {
                primitive: 'cone',
                height: Math.min(distance * 0.3, 0.5), // Scale arrow size based on distance
                radiusBottom: 0.1,
                radiusTop: 0.01
            });

            // Position arrow halfway between points
            arrow.setAttribute('position', `
                ${x + direction.x * 0.5}
                ${y + direction.y * 0.5}
                ${z + direction.z * 0.5}
            `);

            // Calculate rotation to point to next waypoint
            const rotation = calculateRotation(direction);
            arrow.setAttribute('rotation', `${rotation.x} ${rotation.y} ${rotation.z}`);
            
            // Set arrow color
            arrow.setAttribute('material', 'color: #3498db');
            
            pathEntity.appendChild(arrow);
        }
    });

    pathContainer.appendChild(pathEntity);
}

function calculateRotation(direction) {
    // Calculate rotation angles based on direction vector
    const pitch = -Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
    const yaw = Math.atan2(direction.x, direction.z);
    
    return {
        x: pitch * (180 / Math.PI),
        y: yaw * (180 / Math.PI),
        z: 0
    };
}

// Search and display locations
async function handleSearch() {
    const searchQuery = searchBar.value.trim().toLowerCase();
    if (searchQuery) {
        try {
            const response = await fetch(`/api/coordinates?search=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            const filteredLocations = data.filter(location => 
                location.locationName.toLowerCase().includes(searchQuery) ||
                location.description.toLowerCase().includes(searchQuery)
            );
            
            if (filteredLocations.length > 0) {
                createLocationMarkers(filteredLocations);
            } else {
                alert('No locations found matching your search');
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('An error occurred while searching');
        }
    }
}

function selectLocation(location) {
    selectedLocation = location;
    navigationPath = calculatePath(currentPosition, location);
    createNavigationPath();
    
    // Update navigation info
    const navInfo = document.getElementById('nav-info');
    navInfo.classList.add('active');
    document.getElementById('distance-value').textContent = '0';
}

function calculatePath(start, end) {
    // For now, return direct path. Can be enhanced with pathfinding algorithm
    return [start, end];
}

// Event Listeners
startBtn.addEventListener('click', startNavigation);
stopBtn.addEventListener('click', stopNavigation);
locationSelect.addEventListener('change', async (event) => {
    const selectedLocation = event.target.value;
    try {
        const response = await fetch(`${backendUrl}/coordinates?location=${encodeURIComponent(selectedLocation)}`);
        const data = await response.json();
        createLocationMarkers(data); // Use the retrieved coordinates to create markers
        createNavigationPath(); // Call to create the navigation path
    } catch (error) {
        console.error('Error fetching coordinates:', error);
        alert('Failed to load coordinates for the selected location');
    }
});



// Navigation control functions
function startNavigation() {
    if (!selectedLocation) {
        alert('Please select a destination first');
        return;
    }
    
    // Show navigation UI
    navInfo.classList.add('active');
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    
    console.log('Navigation started'); // Debugging log

    // Create full navigation path from current position to selected location
    navigationPath = getAllPathPoints();
    createNavigationPath();
}


function stopNavigation() {
    // Hide navigation UI
    navInfo.classList.remove('active');
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    
    console.log('Navigation stopped'); // Debugging log

    // Clear navigation path
    selectedLocation = null;
    navigationPath = [];
    createNavigationPath();
}


function getAllPathPoints() {
    // Return all points in order from start to destination
    return [
        { x: 0.18844, y: -1.081, z: -1.4116, markerType: 'START', locationName: 'Admin Entrance' },
        { x: 0.64347, y: -2.1809, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 1' },
        { x: 1.0844, y: -3.5544, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 2' },
        { x: 1.4741, y: -4.7743, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 3' },
        { x: 1.9628, y: -6.6293, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 4' },
        { x: 2.4148, y: -8.0416, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 5' },
        { x: 2.8363, y: -10.118, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 6' },
        { x: 3.2908, y: -11.886, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 7' },
        { x: 3.6405, y: -13.038, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 8' },
        { x: 3.9757, y: -14.164, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 9' },
        { x: 4.3366, y: -15.421, z: -1.4116, markerType: 'WAYPOINT', locationName: 'Waypoint 10' },
        { x: 4.8435, y: -16.692, z: -1.4116, markerType: 'DESTINATION', locationName: 'Destination' }
    ];
}

// Initialize application
function initializeAR() {
    loadModelAndPath();
}

// Initialize application
initializeAR();
