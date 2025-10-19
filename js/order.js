

// Global variables
let items = [];
let cart = [];

// Priority items that should appear at the top
const PRIORITY_ITEMS = ['A039', 'A042', 'F074', 'SB06', 'TS09', 'BR08'];

// Initialize on DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM Content Loaded - Starting initialization');
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-overlay';
        loadingDiv.innerHTML = '<div class="loading-spinner"></div><p>Loading items...</p>';
        document.body.appendChild(loadingDiv);
        
        // Initialize items from IndexedDB or Firebase
        const loadedItems = await initializeItems();
        
        console.log(`Initialization complete. Loaded ${loadedItems.length} items`);
        
        if (loadedItems.length === 0) {
            loadingDiv.innerHTML = '<p style="color: red;">No items found. Please contact administrator.</p>';
            return;
        }
        
        // Replace the global items variable
        window.items = loadedItems;
        items = loadedItems;
        
        // Remove loading indicator
        loadingDiv.remove();
        
        // Show details for first priority item or first item
        const defaultItem = loadedItems.find(item => item.name === 'A039') || loadedItems[0];
        if (defaultItem) {
            console.log('Showing default item:', defaultItem.name);
            showItemDetails(defaultItem);
        }
        
        // Initialize suggestion list with priority items at top
        updateItemList();
        
        // Initialize cart status
        updateCartButtonsStatus();
        
        // Initialize scroll functionality
        initializeScroll();
        enableSuggestionScroll();
        
        // Initialize event listeners
        initializeEventListeners();
        
        console.log('Application ready');
        
    } catch (error) {
        console.error('Critical error during initialization:', error);
        const loadingDiv = document.querySelector('.loading-overlay');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <p style="color: red; padding: 20px; text-align: center;">
                    Failed to load application data.<br>
                    Error: ${error.message}<br>
                    <button onclick="window.location.reload()" style="margin-top: 10px; padding: 10px 20px;">
                        Retry
                    </button>
                </p>
            `;
        }
    }
});

// IndexedDB Functions
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('KARetailDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('items')) {
                const itemStore = db.createObjectStore('items', { keyPath: 'name' });
                itemStore.createIndex('style', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
        };
    });
}

// Transform Firebase data structure to app structure
function transformFirebaseDataToAppFormat(firebaseItems) {
    const groupedByStyle = {};
    
    firebaseItems.forEach(item => {
        const style = item.Style;
        
        if (!groupedByStyle[style]) {
            groupedByStyle[style] = {
                name: style,
                sizes: [],
                colors: [],
                colorname: []
            };
        }
        
        if (item.Size && !groupedByStyle[style].sizes.includes(item.Size)) {
            groupedByStyle[style].sizes.push(item.Size);
        }
        
        if (item.Color && !groupedByStyle[style].colors.includes(item.Color)) {
            groupedByStyle[style].colors.push(item.Color);
        }
        
        const colorName = item['Color Name'] || item.Color || '';
        const mrp = item.MRP ? item.MRP.trim() : '';
        const colorNameEntry = `${item.Color} : ${colorName}, ${mrp}`;
        
        if (item.Color && !groupedByStyle[style].colorname.some(cn => cn.startsWith(`${item.Color} :`))) {
            groupedByStyle[style].colorname.push(colorNameEntry);
        }
    });
    
    // Sort sizes for each style
    Object.values(groupedByStyle).forEach(style => {
        if (style.sizes && style.sizes.length > 0) {
            style.sizes.sort((a, b) => {
                const sizeOrder = [
                    '30A', '30B', '30C', '30D', '30DD', '30E',
                    '32A', '32B', '32C', '32D', '32DD', '32E', '32Z',
                    '34A', '34B', '34C', '34D', '34DD', '34E', '34Z',
                    '36A', '36B', '36C', '36D', '36DD', '36E', '36Z',
                    '38A', '38B', '38C', '38D', '38DD', '38E', '38Z',
                    '40A', '40B', '40C', '40D', '40DD', '40E', '40Z',
                    '42A', '42B', '42C', '42D', '42DD', '42E', '42Z',
                    '44A', '44B', '44C', '44D', '44DD', '44E', '44Z',
                    'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL',
                    '28', '30', '32', '34', '36', '38', '40', '42', '44'
                ];
                
                if (!a) return 1;
                if (!b) return -1;
                
                const aIndex = sizeOrder.indexOf(a);
                const bIndex = sizeOrder.indexOf(b);
                
                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                }
                
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                
                return a.localeCompare(b);
            });
        }
    });
    
    return Object.values(groupedByStyle);
}

// Save items to IndexedDB
async function saveItemsToIndexedDB(items) {
    const db = await initIndexedDB();
    const transaction = db.transaction(['items'], 'readwrite');
    const itemStore = transaction.objectStore('items');
    
    await itemStore.clear();
    
    const addPromises = items.map(item => {
        return new Promise((resolve, reject) => {
            const request = itemStore.add(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
    
    await Promise.all(addPromises);
    
    const metadataTransaction = db.transaction(['metadata'], 'readwrite');
    const metadataStore = metadataTransaction.objectStore('metadata');
    await metadataStore.put({ key: 'lastSync', timestamp: Date.now() });
    
    return items;
}

// Load items from IndexedDB
async function loadItemsFromIndexedDB() {
    try {
        const db = await initIndexedDB();
        const transaction = db.transaction(['items'], 'readonly');
        const itemStore = transaction.objectStore('items');
        
        return new Promise((resolve, reject) => {
            const request = itemStore.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error loading from IndexedDB:', error);
        return [];
    }
}

// Check if Firebase data has been updated
async function checkFirebaseForUpdates() {
    try {
        const db = await initIndexedDB();
        const transaction = db.transaction(['metadata'], 'readonly');
        const metadataStore = transaction.objectStore('metadata');
        
        const lastSync = await new Promise((resolve, reject) => {
            const request = metadataStore.get('lastSync');
            request.onsuccess = () => resolve(request.result?.timestamp || 0);
            request.onerror = () => reject(request.error);
        });
        
        const snapshot = await firebase.database().ref('itemData/lastModified').once('value');
        const firebaseLastModified = snapshot.val() || 0;
        
        return firebaseLastModified > lastSync;
    } catch (error) {
        console.error('Error checking Firebase updates:', error);
        return true;
    }
}

// Fetch items from Firebase
async function fetchItemsFromFirebase() {
    try {
        console.log('Fetching items from Firebase...');
        const snapshot = await firebase.database().ref('itemData/items').once('value');
        const firebaseData = snapshot.val();
        
        console.log('Firebase data received:', firebaseData ? 'Data exists' : 'No data');
        
        if (!firebaseData) {
            console.warn('No data found in Firebase at itemData/items');
            return [];
        }
        
        if (!Array.isArray(firebaseData)) {
            console.error('Firebase data is not an array:', typeof firebaseData);
            throw new Error('Invalid data structure from Firebase - expected array');
        }
        
        if (firebaseData.length === 0) {
            console.warn('Firebase returned empty array');
            return [];
        }
        
        console.log(`Processing ${firebaseData.length} items from Firebase`);
        const transformedItems = transformFirebaseDataToAppFormat(firebaseData);
        console.log(`Transformed into ${transformedItems.length} unique styles`);
        
        return transformedItems;
    } catch (error) {
        console.error('Error fetching from Firebase:', error);
        throw error;
    }
}

// Initialize items
async function initializeItems() {
    try {
        console.log('Initializing items...');
        
        let items = await loadItemsFromIndexedDB();
        console.log(`Loaded ${items.length} items from IndexedDB`);
        
        if (items.length === 0 || await checkFirebaseForUpdates()) {
            console.log('Fetching fresh data from Firebase...');
            items = await fetchItemsFromFirebase();
            
            if (items.length === 0) {
                console.error('No items received from Firebase');
                alert('No items found in database. Please contact administrator.');
                return [];
            }
            
            await saveItemsToIndexedDB(items);
            console.log('Items synced and saved to IndexedDB');
        } else {
            console.log('Using cached items from IndexedDB');
        }
        
        return items;
    } catch (error) {
        console.error('Error initializing items:', error);
        
        try {
            const fallbackItems = await loadItemsFromIndexedDB();
            if (fallbackItems.length > 0) {
                console.log('Using cached items as fallback');
                alert('Could not sync with server. Using cached data.');
                return fallbackItems;
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
        
        alert('Error loading item data. Please check your internet connection and refresh the page.');
        return [];
    }
}

// Show item details
function showItemDetails(item) {
    let itemNameDisplay = document.querySelector('.item-name-display');
    if (!itemNameDisplay) {
        itemNameDisplay = document.createElement('div');
        itemNameDisplay.className = 'item-name-display';
        const searchContainer = document.querySelector('.search-container');
        searchContainer.insertAdjacentElement('afterend', itemNameDisplay);
    }
    
    const itemLink = document.createElement('a');
    itemLink.textContent = item.name;
    const encodedItemName = encodeURIComponent(item.name);
    itemLink.href = `https://www.enamor.co.in/search?q=${encodedItemName}&options%5Bprefix%5D=last&type=product`;
    itemLink.target = "_blank";
    
    itemNameDisplay.innerHTML = '';
    itemNameDisplay.appendChild(itemLink);
    
    const colorsContainer = document.querySelector('.colors-container');
    colorsContainer.innerHTML = '';
    
    item.colors.forEach(color => {
        const colorContainer = createColorContainer(item, color);
        colorsContainer.appendChild(colorContainer);
    });
}

// Create color container
function createColorContainer(item, color) {
    const container = document.createElement('div');
    container.classList.add('color-container');
    
    const header = document.createElement('h4');
    header.textContent = color;
    container.appendChild(header);
    
    const backgroundColor = getBackgroundColor(color);
    let textColor = 'black';
    let textShadow = '';

    if (backgroundColor) {
        if (backgroundColor.includes('url')) {
            container.style.background = backgroundColor;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            textColor = 'white';
            textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
        } else if (backgroundColor.includes('linear-gradient')) {
            container.style.background = backgroundColor;
            textColor = 'white';
            textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
        } else {
            container.style.backgroundColor = backgroundColor;
            const rgb = getRGBFromColor(backgroundColor);
            if (rgb) {
                const brightness = getBrightness(rgb.r, rgb.g, rgb.b);
                textColor = brightness > 128 ? 'black' : 'white';
                if (brightness > 100 && brightness < 150) {
                    textShadow = '1px 1px 1px rgba(0,0,0,0.3)';
                }
            }
        }
    } else {
        container.style.border = '1px solid #ccc';
        textColor = 'black';
    }
    
    header.style.color = textColor;
    if (textShadow) {
        header.style.textShadow = textShadow;
    }
    
    const gridContainer = document.createElement('div');
    gridContainer.classList.add('size-quantity-grid');
    gridContainer.style.display = 'none';
    
    item.sizes.forEach(size => {
        const row = document.createElement('div');
        row.classList.add('size-quantity-row');
        
        const sizeCell = document.createElement('div');
        sizeCell.classList.add('size-cell');
        const sizeLabel = document.createElement('label');
        sizeLabel.classList.add('size-label');
        sizeLabel.textContent = size;
        
        sizeLabel.style.color = textColor;
        if (textShadow) {
            sizeLabel.style.textShadow = textShadow;
        }
        
        sizeCell.appendChild(sizeLabel);
        
        const quantityCell = document.createElement('div');
        quantityCell.classList.add('quantity-cell');
        
        const quantityControl = document.createElement('div');
        quantityControl.classList.add('quantity-control');
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'quantity-input custom-qty';
        input.name = `qty_${color}_${size}`;
        input.min = '0';
        input.value = '0';
        
        input.addEventListener('focus', function() {
            if (this.value === '0') {
                this.value = '';
            }
        });

        input.addEventListener('blur', function() {
            if (this.value === '') {
                this.value = '0';
            }
        });
        
        quantityControl.appendChild(input);
        quantityCell.appendChild(quantityControl);
        row.appendChild(sizeCell);
        row.appendChild(quantityCell);
        gridContainer.appendChild(row);
    });
    
    container.appendChild(gridContainer);
    container.addEventListener('click', handleColorContainerClick);
    
    return container;
}

// Get RGB from color
function getRGBFromColor(color) {
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return { r, g, b };
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.style.color = color;
    document.body.appendChild(tempDiv);
    const computedColor = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    
    const match = computedColor.match(/(\d+), (\d+), (\d+)/);
    if (match) {
        return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3])
        };
    }
    return null;
}

// Get brightness
function getBrightness(r, g, b) {
    return ((r * 299) + (g * 587) + (b * 114)) / 1000;
}

// Get background color mapping
function getBackgroundColor(color) {
    const colorMap = {
        'BLACK': 'black',
        'WHITE': '#FFFFFF',
        'GRW': '#341917',
        'GRYMRL': '#d8d7dc',
        'LILAST': `url("https://www.enamor.co.in/cdn/shop/files/5_ea03e152-8bbc-4cb3-b605-7ec29a515d86.jpg?v=1684217469") 75% 50% / cover no-repeat`,
        'LIMAPR': 'url("https://www.enamor.co.in/cdn/shop/files/1AvTEPQ_KfpsXo7Tzhyb6Q45y0usBJr7S.jpg?v=1696598482") 75% 50% /  cover no-repeat',
        'RESWPR': 'url(" https://www.enamor.co.in/cdn/shop/files/1nncqC7eWXEd5EVIPwJJUGsS4YfX-Igyz.jpg?v=1696598470") 75% 50% /  cover no-repeat',
        'EVB': 'navy',
        'PEARL': '#E6C7B8',
        'SKIN': '#E4C7A7',
        'DIO': 'white',
        'JBK': '#0A0A0A',
        'PCMARG': 'cyan',
        'PSMARG': 'lightpink',
        'EVEBLU': '#222133',
        'MASAI': 'url(" https://www.enamor.co.in/cdn/shop/products/a014_masai_13__1_large.jpg?v=1676456937") 30% 50% /  1500% no-repeat',
        'BPRP': 'url(" https://www.enamor.co.in/cdn/shop/files/5_4fba307d-bfc2-471e-b91f-c1b5bf2d0dba_large.jpg?v=1683789659") 75% 50% /  cover no-repeat',
        'PPRP': 'url("https://www.enamor.co.in/cdn/shop/files/5_5b158d6a-bc65-49bd-8f0f-4382ba1b513f_large.jpg?v=1683789670")75% 50% /  cover no-repeat',
        'CPM': '#D2E3EB',
        'GKP': 'url("https://www.enamor.co.in/cdn/shop/products/6_836_large.jpg?v=1700655975")75% 50% /  cover no-repeat',
        'ODM': '#EEC9D3',
        'RSBLSH': '#D5868E',
        'PLS': '#D4C2B6',
        'GRYMEL': '#d8d7dc',
        'BDE': 'url("https://www.enamor.co.in/cdn/shop/products/00a027bde_1_4_large.jpg?v=1676458803")65% 100% /  1600% no-repeat',
        'RTE': '#CC746D',
        'ECL': '#2F2F4A',
        'SLI': 'url("https://www.enamor.co.in/cdn/shop/products/6_841_12_large.jpg?v=1676464479")0% 0% /  1000% no-repeat',
        'CHYBLS': 'url("https://www.enamor.co.in/cdn/shop/products/4_1000_1_large.jpg?v=1716458121")67% 90% /  1400% no-repeat',
        'CHIVIO': 'url("https://www.enamor.co.in/cdn/shop/files/6_ad2713ea-70f4-497a-9c1b-a33d892d2cd2_large.jpg?v=1708944721")75% 80% /  1000% no-repeat',
        'CMG': '#B5C4D8',
        'GSP': 'url("https://www.enamor.co.in/cdn/shop/products/6_876.jpg?v=1676466389")0% 20% /  1000% no-repeat',
        'DDO': 'url("https://www.enamor.co.in/cdn/shop/products/6_875.jpg?v=1676466411")0% 20% /  1000% no-repeat',
        'LPR': 'url("https://www.enamor.co.in/cdn/shop/files/18b1XCLuTl3M_ytx9Tb1tLfUEK1RDyrBp_large.jpg?v=1696598795")50% 50% /  500% no-repeat',
        'PURPLE': '#6C2B6A',
        'TMG': '#E67F81',
        'RVL': 'url("https://www.enamor.co.in/cdn/shop/products/6_920_4.jpg?v=1677836790")0% 20% /  1000% no-repeat',
        'CFAUP': 'url("https://www.enamor.co.in/cdn/shop/files/5_d2d4cfd4-fb0e-4566-b6a7-8ff9aaaa06ce_large.jpg?v=1683790128")0% 30% /  500% no-repeat',
        'TLPP': 'url("https://www.enamor.co.in/cdn/shop/files/5_eb8ecf80-5f52-46a4-a872-d2e1477beb61.jpg?v=1683790138")0% 30% /  500% no-repeat',
        'PHB': '#E78A84',
        'OLT': '#E9E2D7',
        'BRI': '#B82230',
        'PBH': '#D0A095',
        'TSE': '#8DC8D0',
        'PHP': '#EAD4CC',
        'MFL': 'url("https://www.enamor.co.in/cdn/shop/products/6_888.jpg?v=1676462012")50% 100% /  800% no-repeat',
        'GRS': 'linear-gradient(to left, #341917 50%, #E4C7A7 50%)',
        'WHG': 'linear-gradient(to left, #FFFFFF 50%, #d8d7dc 50%)',
        'DHP': 'url("https://www.enamor.co.in/cdn/shop/products/5_1089.jpg?v=1676464602")50% 80% /  800% no-repeat',
        'MMV': 'url("https://www.enamor.co.in/cdn/shop/products/5_1553.jpg?v=1676466172")50% 80% /  800% no-repeat',
        'MLP': 'url("https://www.enamor.co.in/cdn/shop/products/1_2024_1_2.jpg?v=1676460147")50% 82% /  800% no-repeat',
        'PFI': '#FEE0E0',
        'ALS': '#ECD7D7',
        'LSBNBL': '#1B2032',
        'OCH': '#D4979E',
        'PSTLIL': '#E8DDEA',
        'ARO': 'url("https://www.enamor.co.in/cdn/shop/products/6_869_5.jpg?v=1676466323")50% 82% /  800% no-repeat',
        'AUM': 'url("https://www.enamor.co.in/cdn/shop/products/4_1092_1_4.jpg?v=1676458943")60% 86% /  1200% no-repeat',
        'CLM': '#F0EAE5',
        'WFM': 'url("https://www.enamor.co.in/cdn/shop/files/ENAMORDAY-1_4624_Details_6fbe6d62-5cd6-4f86-9c39-44d156c0e8d8.jpg?v=1718885423")60% 86% /  1200% no-repeat',
        'MNPP': 'url("https://www.enamor.co.in/cdn/shop/products/f097_midnight_peony_print_7.jpg?v=1700657442")0% 30% /  500% no-repeat',
        'LCR': 'url("https://www.enamor.co.in/cdn/shop/products/6_459_17.jpg?v=1676464469")100% 30% /  500% no-repeat',
        'NISH': '#372C3B',
        'NAVY': '#242638',
        'GOBBLU': '#A5BBCF',
        'JETBLK': '#000000',
        'OLVNT': '#483E36',
        'ROUGE': '#EEA49F',
        'HTMBCO': 'url("https://www.enamor.co.in/cdn/shop/files/5_f3f32b28-5db7-4c42-aba8-97fc355e081d.jpg?v=1709016268")50% 60% /  500% no-repeat',
        'PFPGCO': 'url("https://www.enamor.co.in/cdn/shop/files/5_bec821e4-f5ba-4c0c-a013-6048a8ae8005.jpg?v=1709016265")50% 60% /  500% no-repeat',
    };
    return colorMap[color.toUpperCase()] || "";
}

// Handle color container click
function handleColorContainerClick(event) {
    if (event.target.classList.contains('quantity-input') || 
        event.target.classList.contains('size-label')) {
        return;
    }
    
    const colorContainer = event.currentTarget;
    const sizeQuantityGrid = colorContainer.querySelector('.size-quantity-grid');
    
    if (sizeQuantityGrid.style.display === 'none' || 
        sizeQuantityGrid.style.display === '') {
        sizeQuantityGrid.style.display = 'block';
    } else {
        sizeQuantityGrid.style.display = 'none';
    }
}

// Continue in Part 2...
// Order Section JavaScript - Part 2 (Continuation)

// Update item list
function updateItemList(filteredItems = null) {
    const suggestionsContainer = document.querySelector('.suggestions');
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = '';
    
    const itemsToShow = filteredItems || window.items || [];
    
    const sortedItems = [...itemsToShow].sort((a, b) => {
        const aIndex = PRIORITY_ITEMS.indexOf(a.name);
        const bIndex = PRIORITY_ITEMS.indexOf(b.name);
        
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        return a.name.localeCompare(b.name);
    });
    
    sortedItems.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('suggestion-item');
        
        if (PRIORITY_ITEMS.includes(item.name)) {
            div.classList.add('priority-item');
        }
        
        div.textContent = item.name;
        
        div.addEventListener('click', () => {
            const searchInput = document.querySelector('.search-input');
            if (searchInput) {
                searchInput.value = item.name;
            }
            suggestionsContainer.style.display = 'none';
            showItemDetails(item);
        });
        
        suggestionsContainer.appendChild(div);
    });
}

// Filter items
function filterItems(searchText) {
    const itemsToFilter = window.items || [];
    
    if (!searchText) {
        return itemsToFilter;
    }
    
    const searchLower = searchText.toLowerCase();
    
    return itemsToFilter
        .filter(item => item.name.toLowerCase().includes(searchLower))
        .sort((a, b) => {
            const aStartsWith = a.name.toLowerCase().startsWith(searchLower);
            const bStartsWith = b.name.toLowerCase().startsWith(searchLower);
            
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            
            const aIsPriority = PRIORITY_ITEMS.includes(a.name);
            const bIsPriority = PRIORITY_ITEMS.includes(b.name);
            
            if (aIsPriority && !bIsPriority) return -1;
            if (!aIsPriority && bIsPriority) return 1;
            
            if (aIsPriority && bIsPriority) {
                return PRIORITY_ITEMS.indexOf(a.name) - PRIORITY_ITEMS.indexOf(b.name);
            }
            
            return 0;
        });
}

// Initialize event listeners
function initializeEventListeners() {
    const searchInput = document.querySelector('.search-input');
    const suggestionsContainer = document.querySelector('.suggestions');
    
    searchInput.addEventListener('input', (e) => {
        const filteredItems = filterItems(e.target.value);
        updateItemList(filteredItems);
        suggestionsContainer.style.display = filteredItems.length ? 'block' : 'none';
    });
    
    searchInput.addEventListener('focus', () => {
        updateItemList();
        suggestionsContainer.style.display = 'block';
        addRippleEffect(event);
    });
    
    document.addEventListener('click', (e) => {
        if (!suggestionsContainer.contains(e.target) && e.target !== searchInput) {
            suggestionsContainer.style.display = 'none';
        }
    });
    
    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    const cartEmptyBtn = document.querySelector('.cart-empty-btn');
    
    addToCartBtn.addEventListener('click', addToCart);
    cartEmptyBtn.addEventListener('click', () => {
        if (cart.length > 0) {
            showOrderSummaryModal();
        } else {
            cart = [];
            updateCartSummary();
            updateCartButtonsStatus();
        }
    });
}

// Add to cart function
function addToCart() {
    const itemNameDisplay = document.querySelector('.item-name-display a');
    if (!itemNameDisplay) {
        alert("Please select an item first.");
        return;
    }
    const itemName = itemNameDisplay.textContent;
    
    const item = (window.items || []).find(i => i.name === itemName);
    if (!item) {
        alert("Selected item not found.");
        return;
    }

    const cartItem = {
        name: itemName,
        colors: {}
    };

    let itemAdded = false;
    let itemTotalQuantity = 0;

    const colorContainers = document.querySelectorAll('.color-container');
    colorContainers.forEach(container => {
        const color = container.querySelector('h4').textContent;
        const quantityInputs = container.querySelectorAll('.quantity-input');
        
        cartItem.colors[color] = {};
        
        quantityInputs.forEach(input => {
            const size = input.name.split('_')[2];
            const qty = parseInt(input.value) || 0;
            
            if (qty > 0) {
                cartItem.colors[color][size] = qty;
                itemAdded = true;
                itemTotalQuantity += qty;
            }
        });
    });

    if (!itemAdded) {
        alert("Please select at least one size and quantity.");
        return;
    }

    const existingItemIndex = cart.findIndex(item => item.name === itemName);
    if (existingItemIndex !== -1) {
        Object.keys(cartItem.colors).forEach(color => {
            if (!cart[existingItemIndex].colors[color]) {
                cart[existingItemIndex].colors[color] = {};
            }
            Object.entries(cartItem.colors[color]).forEach(([size, qty]) => {
                if (cart[existingItemIndex].colors[color][size]) {
                    cart[existingItemIndex].colors[color][size] += qty;
                } else {
                    cart[existingItemIndex].colors[color][size] = qty;
                }
            });
        });
    } else {
        cart.push(cartItem);
    }

    updateCartSummary();
    updateCartButtonsStatus();
    resetQuantityInputs();
    showAddedToCartFeedback();
}

// Create cart summary table
function createCartSummaryTable() {
    let cartSummaryContainer = document.querySelector('.cart-summary-container');
    
    if (!cartSummaryContainer) {
        cartSummaryContainer = document.createElement('div');
        cartSummaryContainer.className = 'cart-summary-container';
        
        const colorsContainer = document.querySelector('.colors-container');
        if (colorsContainer) {
            colorsContainer.insertAdjacentElement('afterend', cartSummaryContainer);
        }
    }

    const table = document.createElement("table");
    table.id = "cartSummary";
    table.className = "cart-summary-table";
    table.innerHTML = `
        <thead>
            <tr>
                <th>Item Name & Color</th>
                <th>Size and Qty</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    cartSummaryContainer.innerHTML = '';
    cartSummaryContainer.appendChild(table);
    
    return table;
}

// Update cart summary
function updateCartSummary() {
    const cartSummary = document.getElementById("cartSummary") || createCartSummaryTable();
    const tbody = cartSummary.querySelector("tbody");
    tbody.innerHTML = "";

    let totalQuantity = 0;

    cart.forEach((item, itemIndex) => {
        Object.entries(item.colors).forEach(([color, sizes]) => {
            let colorTotal = 0;
            let sizesAndQuantities = [];

            Object.entries(sizes).forEach(([size, qty]) => {
                if (qty > 0) {
                    sizesAndQuantities.push(`${size}/${qty}`);
                    colorTotal += qty;
                    totalQuantity += qty;
                }
            });

            if (colorTotal > 0) {
                const row = document.createElement("tr");
                row.className = "clickable-row";
                row.innerHTML = `
                    <td>${item.name} (${color})</td>
                    <td>${sizesAndQuantities.join(", ")}</td>
                    <td>${colorTotal}</td>
                `;
                
                row.addEventListener('click', () => {
                    showEditItemModal(itemIndex, color, false);
                });
                
                tbody.appendChild(row);
            }
        });
    });

    const cartSummaryContainer = document.querySelector('.cart-summary-container');
    if (cartSummaryContainer) {
        cartSummaryContainer.style.display = cart.length > 0 ? 'block' : 'none';
    }

    updateCartButtonsStatus();
}

// Show edit item modal
function showEditItemModal(itemIndex, color, isOrderSummaryModal = false) {
    const item = cart[itemIndex];
    const sizes = Object.keys(item.colors[color]);

    const existingModal = document.getElementById("editItemModal");
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "editItemModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Item: ${item.name} (${color})</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    ${sizes.map(size => `
                        <div class="mb-3 d-flex align-items-center">
                            <label class="form-label me-2 mb-0" style="width: 50px;">${size}</label>
                            <div class="input-group" style="width: 150px;">
                                <button class="btn btn-outline-secondary minus-btn" type="button" data-size="${size}">-</button>
                                <input type="number" class="form-control text-center" id="qty_${size}" value="${item.colors[color][size] || 0}" min="0" readonly>
                                <button class="btn btn-outline-secondary plus-btn" type="button" data-size="${size}">+</button>
                            </div>
                        </div>
                    `).join("")}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" id="deleteItemBtn">Delete Item</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveItemBtn">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const editModalInstance = new bootstrap.Modal(document.getElementById("editItemModal"));

    const updateQuantity = (size, change) => {
        const input = document.getElementById(`qty_${size}`);
        const currentValue = parseInt(input.value) || 0;
        input.value = Math.max(0, currentValue + change);
    };

    modal.querySelectorAll(".minus-btn").forEach(btn => {
        btn.addEventListener("click", () => updateQuantity(btn.dataset.size, -1));
    });
    
    modal.querySelectorAll(".plus-btn").forEach(btn => {
        btn.addEventListener("click", () => updateQuantity(btn.dataset.size, 1));
    });

    document.getElementById("saveItemBtn").addEventListener("click", () => {
        saveItemChanges(itemIndex, color, isOrderSummaryModal);
        editModalInstance.hide();
    });

    document.getElementById("deleteItemBtn").addEventListener("click", () => {
        if (confirm('Are you sure you want to remove this item?')) {
            deleteCartItem(itemIndex, color, isOrderSummaryModal);
            editModalInstance.hide();
        }
    });

    editModalInstance.show();
}

// Save item changes
function saveItemChanges(itemIndex, color, isOrderSummaryModal) {
    const item = cart[itemIndex];
    const sizes = Object.keys(item.colors[color]);
    let totalQuantity = 0;

    sizes.forEach(size => {
        const newQty = parseInt(document.getElementById(`qty_${size}`).value);
        if (newQty > 0) {
            item.colors[color][size] = newQty;
            totalQuantity += newQty;
        } else {
            delete item.colors[color][size];
        }
    });

    if (totalQuantity === 0) {
        delete item.colors[color];
        if (Object.keys(item.colors).length === 0) {
            cart.splice(itemIndex, 1);
        }
    }

    updateCartSummary();
    if (isOrderSummaryModal) {
        updateModalCartSummary();
    }
}

// Delete cart item
function deleteCartItem(itemIndex, color, isOrderSummaryModal) {
    const item = cart[itemIndex];
    delete item.colors[color];
    if (Object.keys(item.colors).length === 0) {
        cart.splice(itemIndex, 1);
    }

    updateCartSummary();
    if (isOrderSummaryModal) {
        updateModalCartSummary();
    }
}

// Helper functions
function updateCartButtonsStatus() {
    const cartEmptyBtn = document.querySelector('.cart-empty-btn');
    const totalQuantity = calculateTotalQuantity();
    
    if (totalQuantity > 0) {
        cartEmptyBtn.textContent = 'Process Order';
        cartEmptyBtn.classList.add('has-items');
    } else {
        cartEmptyBtn.textContent = 'Cart Empty';
        cartEmptyBtn.classList.remove('has-items');
    }
}

function calculateTotalQuantity() {
    return cart.reduce((total, item) => {
        return total + Object.values(item.colors).reduce((colorTotal, sizes) => {
            return colorTotal + Object.values(sizes).reduce((sizeTotal, qty) => sizeTotal + qty, 0);
        }, 0);
    }, 0);
}

function resetQuantityInputs() {
    const inputs = document.querySelectorAll('.quantity-input');
    inputs.forEach(input => {
        input.value = '0';
    });
}

function showAddedToCartFeedback() {
    const feedback = document.createElement('div');
    feedback.className = 'cart-feedback';
    feedback.textContent = 'Added to cart!';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        document.body.removeChild(feedback);
    }, 2000);
}

// Get username from localStorage
function getUsername() {
    try {
        const stored = localStorage.getItem('kaRetailUser');
        if (stored) {
            const userData = JSON.parse(stored);
            return userData.username || 'Guest';
        }
    } catch (error) {
        console.error('Error getting username:', error);
    }
    return 'Guest';
}

// Get user ID from localStorage
function getUserId() {
    try {
        const stored = localStorage.getItem('kaRetailUser');
        if (stored) {
            const userData = JSON.parse(stored);
            return userData.userId || null;
        }
    } catch (error) {
        console.error('Error getting user ID:', error);
    }
    return null;
}

// Continue in Part 3 for Order Processing...
// Order Section JavaScript - Part 3 (Order Processing)

// Show order summary modal
function showOrderSummaryModal() {
    console.log("showOrderSummaryModal function called");
    
    if (!cart || cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    const username = getUsername();

    try {
        const existingModal = document.getElementById("orderSummaryModal");
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement("div");
        modal.className = "modal fade";
        modal.id = "orderSummaryModal";
        modal.setAttribute("tabindex", "-1");
        modal.setAttribute("aria-labelledby", "orderSummaryModalLabel");
        modal.setAttribute("aria-hidden", "true");
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="orderSummaryModalLabel">Order Summary</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="party-name mb-3">
                            <strong>Party Name:</strong> ${username}
                        </div>
                        <div class="order-details"></div>
                    </div>
                    <div class="modal-footer flex-column align-items-stretch">
                        <div class="mb-3 w-100">
                            <label for="orderNote" class="form-label">Order Note:</label>
                            <textarea class="form-control" id="orderNote" rows="3" placeholder="Enter any special instructions here..."></textarea>
                        </div>
                        <div class="d-flex justify-content-end">
                            <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" id="placeOrderBtn">Place Order</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        
        const placeOrderBtn = modal.querySelector('#placeOrderBtn');
        placeOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handlePlaceOrder();
        });

        modalInstance.show();
        updateModalCartSummary();

    } catch (error) {
        console.error("Error in showOrderSummaryModal:", error);
        alert("An error occurred while showing the order summary. Please try again.");
    }
}

// Update modal cart summary
function updateModalCartSummary() {
    try {
        const orderDetails = document.querySelector("#orderSummaryModal .order-details");
        if (!orderDetails) {
            throw new Error("Order details container not found");
        }

        const username = getUsername();
        let totalQuantity = 0;

        let summaryContent = `
            <table class="table table-bordered table-hover modal-cart-summary">
                <thead>
                    <tr>
                        <th>Item Name & Color</th>
                        <th>Sizes and Qty</th>
                        <th>Item Total</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (!Array.isArray(cart) || cart.length === 0) {
            summaryContent += '<tr><td colspan="3" class="text-center">No items in cart</td></tr>';
        } else {
            cart.forEach((item, index) => {
                if (!item || !item.colors) return;

                Object.entries(item.colors).forEach(([color, sizes]) => {
                    if (!sizes) return;

                    let itemTotal = 0;
                    const sizesAndQty = [];

                    Object.entries(sizes).forEach(([size, qty]) => {
                        const quantity = parseInt(qty);
                        if (quantity > 0) {
                            sizesAndQty.push(`${size}/${quantity}`);
                            itemTotal += quantity;
                            totalQuantity += quantity;
                        }
                    });

                    if (itemTotal > 0) {
                        summaryContent += `
                            <tr class="clickable-row" data-index="${index}" data-color="${color}">
                                <td>${item.name || 'Unnamed Item'} (${color})</td>
                                <td>${sizesAndQty.join(", ")}</td>
                                <td>${itemTotal}</td>
                            </tr>
                        `;
                    }
                });
            });
        }

        summaryContent += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" class="text-end"><strong>Total Quantity</strong></td>
                        <td><strong>${totalQuantity}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;

        orderDetails.innerHTML = summaryContent;

        const clickableRows = orderDetails.querySelectorAll(".clickable-row");
        if (clickableRows) {
            clickableRows.forEach(row => {
                row.addEventListener("click", function() {
                    const itemIndex = parseInt(this.dataset.index);
                    const color = this.dataset.color;
                    if (!isNaN(itemIndex) && color) {
                        showEditItemModal(itemIndex, color, true);
                    }
                });
            });
        }

        const modalTitle = document.querySelector("#orderSummaryModal .modal-title");
        if (modalTitle) {
            modalTitle.textContent = `Order Summary for ${username}`;
        }

        const partyNameElement = document.querySelector("#orderSummaryModal .party-name");
        if (partyNameElement) {
            partyNameElement.innerHTML = `<strong>Party Name:</strong> ${username}`;
        }

        return { success: true, totalQuantity, username };

    } catch (error) {
        console.error("Error in updateModalCartSummary:", error);
        
        const orderDetails = document.querySelector("#orderSummaryModal .order-details");
        if (orderDetails) {
            orderDetails.innerHTML = `
                <div class="alert alert-danger">
                    <p>Error loading order summary. Please try again.</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
        
        return { success: false, error: error.message };
    }
}

// Show user confirmation modal with CAPTCHA
function showUserConfirmationModal() {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('userConfirmationModal');
        if (existingModal) {
            existingModal.remove();
        }

        function generateCaptchaText() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
            let captcha = '';
            for (let i = 0; i < 6; i++) {
                captcha += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return captcha;
        }

        function drawCaptcha(captchaText, canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < 50; i++) {
                ctx.fillStyle = '#' + Math.floor(Math.random()*16777215).toString(16);
                ctx.beginPath();
                ctx.arc(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height,
                    1,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }

            for (let i = 0; i < 4; i++) {
                ctx.strokeStyle = '#' + Math.floor(Math.random()*16777215).toString(16);
                ctx.beginPath();
                ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
                ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
                ctx.stroke();
            }

            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#000';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            
            for (let i = 0; i < captchaText.length; i++) {
                const x = (canvas.width / captchaText.length) * (i + 0.5);
                ctx.save();
                ctx.translate(x, canvas.height/2);
                ctx.rotate((Math.random() - 0.5) * 0.4);
                ctx.fillText(captchaText[i], 0, 0);
                ctx.restore();
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'userConfirmationModal';
        modal.setAttribute('tabindex', '-1');
        
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirm Your Order</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <strong>Important Notice:</strong>
                            <p>Please note that once your order is placed:</p>
                            <ul>
                                <li>It cannot be modified</li>
                                <li>It cannot be cancelled</li>
                            </ul>
                        </div>
                        <p>Please enter the characters shown in the image below:</p>
                        <div class="text-center mb-3">
                            <canvas id="captchaCanvas" width="200" height="70" style="border: 1px solid #dee2e6; border-radius: 4px;"></canvas>
                            <button class="btn btn-link" id="refreshCaptchaBtn">
                                <i class="fas fa-sync-alt"></i> Refresh CAPTCHA
                            </button>
                        </div>
                        <input type="text" class="form-control" id="captchaInput" placeholder="Enter CAPTCHA">
                        <div id="captchaError" class="text-danger mt-2" style="display: none;">
                            Incorrect CAPTCHA. Please try again.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmOrderBtn">Confirm Order</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        
        const confirmOrderBtn = modal.querySelector('#confirmOrderBtn');
        const captchaInput = modal.querySelector('#captchaInput');
        const errorDiv = modal.querySelector('#captchaError');
        const canvas = modal.querySelector('#captchaCanvas');
        const refreshBtn = modal.querySelector('#refreshCaptchaBtn');

        let currentCaptcha = generateCaptchaText();
        drawCaptcha(currentCaptcha, canvas);

        refreshBtn.addEventListener('click', () => {
            currentCaptcha = generateCaptchaText();
            drawCaptcha(currentCaptcha, canvas);
            captchaInput.value = '';
            errorDiv.style.display = 'none';
        });

        confirmOrderBtn.addEventListener('click', () => {
            if (captchaInput.value.trim() === currentCaptcha) {
                modalInstance.hide();
                resolve(true);
            } else {
                errorDiv.style.display = 'block';
                currentCaptcha = generateCaptchaText();
                drawCaptcha(currentCaptcha, canvas);
                captchaInput.value = '';
            }
        });

        modal.addEventListener('hidden.bs.modal', () => {
            resolve(false);
        });

        modalInstance.show();
    });
}

// Handle place order
async function handlePlaceOrder() {
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    if (!placeOrderBtn) {
        console.error("Place order button not found");
        return;
    }

    try {
        const userId = getUserId();
        if (!userId) {
            alert("Please log in to place an order");
            return;
        }

        if (calculateTotalQuantity() === 0) {
            alert("Your cart is empty");
            return;
        }

        // Show user confirmation modal first
        const userConfirmed = await showUserConfirmationModal();
        
        if (!userConfirmed) {
            return;
        }

        // Show loading overlay
        toggleLoadingOverlay(true);
        placeOrderBtn.disabled = true;

        // Get reference number and modal content
        const [refNumber, modalContent] = await Promise.all([
            getNextReferenceNumber(),
            new Promise(resolve => {
                const content = document.querySelector("#orderSummaryModal .modal-content");
                resolve(content);
            })
        ]);

        if (!modalContent) {
            throw new Error("Modal content not found");
        }

        const partyName = getUsername();
        const totalQuantity = calculateTotalQuantity();
        const dateTime = new Date().toISOString();
        const orderNoteElement = document.getElementById("orderNote");
        const orderNote = orderNoteElement ? orderNoteElement.value.trim() : "";

        // Generate screenshot and save order
        const [canvas] = await Promise.all([
            html2canvas(modalContent),
            saveOrderToFirebase({
                referenceNumber: refNumber,
                partyName: partyName,
                dateTime: dateTime,
                items: cart,
                status: "Approval Pending",
                totalQuantity: totalQuantity,
                orderNote: orderNote
            })
        ]);

        const imgData = canvas.toDataURL("image/png");

        // Download the image
        const link = document.createElement("a");
        link.href = imgData;
        link.download = `${partyName.replace(/\s+/g, "_")}_${dateTime.replace(/[:.]/g, "-")}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Close order summary modal
        const orderSummaryModal = bootstrap.Modal.getInstance(document.getElementById("orderSummaryModal"));
        if (orderSummaryModal) {
            orderSummaryModal.hide();
        }

        // Remove existing confirmation modal
        const existingConfirmationModal = document.getElementById("orderConfirmationModal");
        if (existingConfirmationModal) {
            existingConfirmationModal.remove();
        }

        // Show order confirmation modal
        showOrderConfirmationModal({
            referenceNumber: refNumber,
            partyName: partyName,
            dateTime: dateTime
        }, imgData);

        // WhatsApp integration for specific user
        if (userId === '30AAEFM6750F1ZM') {
            let whatsappMessage = `Kindly find the attached order of ${partyName}\n\n`;
            
            cart.forEach(item => {
                whatsappMessage += `${item.name}\n`;
                
                Object.entries(item.colors).forEach(([color, sizes]) => {
                    Object.entries(sizes).forEach(([size, qty]) => {
                        if (qty > 0) {
                            whatsappMessage += `${color} - ${size} / ${qty}\n`;
                        }
                    });
                });
                
                whatsappMessage += '\n';
            });
            
            whatsappMessage += `TOTAL: ${totalQuantity}`;
            
            const encodedMessage = encodeURIComponent(whatsappMessage);
            window.open(`https://wa.me/919284494154?text=${encodedMessage}`, '_blank');
        }

    } catch (error) {
        console.error("Error in order placement process:", error);
        alert("An error occurred during the order process. Please try again.");
    } finally {
        toggleLoadingOverlay(false);
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "Place Order";
    }
}

// Get next reference number from Firebase
function getNextReferenceNumber() {
    const refNumberRef = database.ref('referenceNumbers/counter');
    
    return refNumberRef.transaction((currentValue) => {
        return (currentValue || 0) + 1;
    }).then((result) => {
        if (result.committed) {
            return String(result.snapshot.val()).padStart(3, '0');
        }
        throw new Error('Transaction failed');
    });
}

// Save order to Firebase
function saveOrderToFirebase(order, isUnapproved = true) {
    const path = isUnapproved ? 'unapprovedorders' : 'orders';
    
    return new Promise((resolve, reject) => {
        firebase.database().ref(path).once('value')
            .then((snapshot) => {
                if (!snapshot.exists() && isUnapproved) {
                    return firebase.database().ref(path).set({});
                }
            })
            .then(() => {
                return firebase.database().ref(`${path}/${order.referenceNumber}`).set(order);
            })
            .then(() => {
                resolve();
            })
            .catch((error) => {
                console.error("Firebase save error:", error);
                reject(error);
            });
    });
}

// Show order confirmation modal
function showOrderConfirmationModal(order, imgData) {
    console.log("Showing order confirmation modal");
    
    const existingModal = document.getElementById("orderConfirmationModal");
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "orderConfirmationModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Order Confirmation</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="confirmation-animation">
                        <div class="circle"></div>
                        <div class="checkmark"></div>
                        <div class="pulse"></div>
                    </div>
                    <p>Thank you for your order!</p>
                    <p>Party Name: ${order.partyName}</p>
                    <p>Date & Time: ${new Date(order.dateTime).toLocaleString()}</p>
                    <p>Order Reference Number: <span class="order-number">${order.referenceNumber}</span></p>
                    <p class="status-text">Status: Waiting For Approval</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    let modalInstance;
    try {
        modalInstance = new bootstrap.Modal(document.getElementById("orderConfirmationModal"));
    } catch (error) {
        console.error("Error initializing modal:", error);
        alert("There was an error showing the order confirmation. Your order has been placed successfully.");
        return;
    }

    modal.addEventListener('hidden.bs.modal', function () {
        window.location.reload();
    });

    modalInstance.show();
}

// Toggle loading overlay
function toggleLoadingOverlay(show) {
    const existingOverlay = document.querySelector('.loading-overlay');
    if (show && !existingOverlay) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div><p>Processing order...</p>';
        document.body.appendChild(overlay);
    } else if (!show && existingOverlay) {
        existingOverlay.remove();
    }
}

// Initialize scroll functionality
function initializeScroll() {
    const content = document.querySelector('.section-content');
    if (!content) return;
    
    let startY;
    
    content.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    }, { passive: true });
    
    content.addEventListener('touchmove', (e) => {
        if (!startY) return;
        
        const currentY = e.touches[0].clientY;
        const isAtTop = content.scrollTop <= 0;
        const isAtBottom = content.scrollHeight - content.scrollTop <= content.clientHeight;
        
        if ((isAtTop && currentY > startY) || (isAtBottom && currentY < startY)) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Enable suggestion scroll
function enableSuggestionScroll() {
    const suggestionsDiv = document.querySelector('.suggestions');
    const searchInput = document.querySelector('.search-input');
    
    suggestionsDiv.addEventListener('wheel', (e) => {
        e.stopPropagation();
        
        const scrollTop = suggestionsDiv.scrollTop;
        const scrollHeight = suggestionsDiv.scrollHeight;
        const clientHeight = suggestionsDiv.clientHeight;
        
        const scrollingUp = e.deltaY < 0;
        const scrollingDown = e.deltaY > 0;
        
        if ((scrollingUp && scrollTop <= 0) || 
            (scrollingDown && scrollTop + clientHeight >= scrollHeight)) {
            e.preventDefault();
        }
    }, { passive: false });

    suggestionsDiv.addEventListener('touchmove', (e) => {
        e.stopPropagation();
    }, { passive: true });

    suggestionsDiv.style.cssText = `
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
    `;

    searchInput.addEventListener('focus', () => {
        document.body.style.overflow = 'hidden';
    });

    searchInput.addEventListener('blur', () => {
        document.body.style.overflow = '';
    });
}

// Add ripple effect
function addRippleEffect(event) {
    const searchContainer = document.querySelector('.search-container');
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    
    const rect = searchContainer.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
    `;
    
    searchContainer.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Manual sync function
async function syncItemsFromFirebase() {
    try {
        toggleLoadingOverlay(true);
        console.log('Syncing items from Firebase...');
        
        const items = await fetchItemsFromFirebase();
        await saveItemsToIndexedDB(items);
        
        window.items = items;
        
        updateItemList();
        
        const defaultItem = items.find(item => item.name === 'A039') || items[0];
        if (defaultItem) {
            showItemDetails(defaultItem);
        }
        
        toggleLoadingOverlay(false);
        alert('Items synced successfully!');
        
    } catch (error) {
        console.error('Error syncing items:', error);
        toggleLoadingOverlay(false);
        alert('Error syncing items. Please try again.');
    }
}

// Export functions for console debugging
window.orderDebug = {
    syncItemsFromFirebase,
    getCart: () => cart,
    getItems: () => items,
    clearCart: () => {
        cart = [];
        updateCartSummary();
        updateCartButtonsStatus();
    }
};

console.log('Order system initialized. Debug functions available at window.orderDebug');