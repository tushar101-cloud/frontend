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
    let coordinates = [
        createCoordinate(606937.50, 2956334.49, 94.0, "Seminar Hall Entrance", "Entrance to the seminar hall", "ENTRANCE"),
        createCoordinate(606943.03, 2956338.86, 0.0, "Seminar Hall Waypoint 1", "First waypoint near seminar hall", "WAYPOINT"),
        createCoordinate(606945.92, 2956338.55, 0.0, "Seminar Hall Waypoint 2", "Second waypoint near seminar hall", "WAYPOINT"),
        createCoordinate(606946.12, 2956338.44, 0.0, "Seminar Hall Waypoint 3", "Third waypoint near seminar hall", "WAYPOINT"),
        createCoordinate(606948.23, 2956337.99, 0.0, "Seminar Hall Waypoint 4", "Fourth waypoint near seminar hall", "WAYPOINT"),
        createCoordinate(606949.85, 2956336.74, 0.0, "Seminar Hall Waypoint 5", "Fifth waypoint near seminar hall", "WAYPOINT")
    ];

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

function handleScannedCoordinates(coordinates) {
    console.log("Handling scanned coordinates:", coordinates);
    // Update the current position and navigation path based on scanned coordinates
    currentPosition = { x: coordinates.x, y: coordinates.y, z: coordinates.z };
    selectedLocation = coordinates.locationName; // Assuming the QR code contains a location name
    navigationPath = [currentPosition]; // Set the navigation path to the scanned coordinates
    createNavigationPath(); // Update the navigation path display
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
        { x: 606937.50, y: 94.0, z: 2956334.49, markerType: 'ENTRANCE', locationName: 'Seminar Hall Entrance' },
        { x: 606943.03, y: 0.0, z: 2956338.86, markerType: 'WAYPOINT', locationName: 'Seminar Hall Waypoint 1' },
        { x: 606945.92, y: 0.0, z: 2956338.55, markerType: 'WAYPOINT', locationName: 'Seminar Hall Waypoint 2' },
        { x: 606946.12, y: 0.0, z: 2956338.44, markerType: 'WAYPOINT', locationName: 'Seminar Hall Waypoint 3' },
        { x: 606948.23, y: 0.0, z: 2956337.99, markerType: 'WAYPOINT', locationName: 'Seminar Hall Waypoint 4' },
        { x: 606949.85, y: 0.0, z: 2956336.74, markerType: 'WAYPOINT', locationName: 'Seminar Hall Waypoint 5' }
    ];
}

// Initialize application
function initializeAR() {
    loadModelAndPath();
}

// Initialize application
initializeAR();
