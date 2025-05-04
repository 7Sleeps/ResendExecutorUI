document.addEventListener('DOMContentLoaded', () => {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.main-section');
    const editorContainer = document.getElementById('editor-container');
    const tabBar = document.getElementById('tab-bar');
    const minimapToggle = document.getElementById('minimap-toggle');
    const themeSelect = document.getElementById('theme-select');

    let editor;
    let openTabs = []; // Stores { id, name, content, language, viewState }
    let activeTabId = null;

    // --- Monaco Editor Themes ---
    const editorThemes = {
        // Built-in
        "vs": { name: "Visual Studio Light", type: "light" },
        "vs-dark": { name: "Visual Studio Dark", type: "dark" },
        "hc-black": { name: "High Contrast Dark", type: "dark" },
        "hc-light": { name: "High Contrast Light", type: "light" },

        // Custom Definitions (Add more here!)
        "nord": { name: "Nord", type: "dark" },
        "solarized-dark": { name: "Solarized Dark", type: "dark" },
        "solarized-light": { name: "Solarized Light", type: "light" },
        "monokai": { name: "Monokai", type: "dark" },
        "github-dark": { name: "GitHub Dark", type: "dark" },
        "github-light": { name: "GitHub Light", type: "light" },
        "dracula": { name: "Dracula", type: "dark" },
        "cobalt": { name: "Cobalt", type: "dark" },
        "one-dark-pro": { name: "One Dark Pro", type: "dark" },
        "material-darker": { name: "Material Darker", type: "dark" },
        "material-lighter": { name: "Material Lighter", type: "light" },
        "kimbie-dark": { name: "Kimbie Dark", type: "dark" }
        // Add ~16 total
    };

    // --- Monaco Editor Initialization ---
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.48.0/min/vs' }});
    window.MonacoEnvironment = {
        getWorkerUrl: function (moduleId, label) {
            // Basic worker setup (adjust if specific language workers needed)
            return './vs/editor/editor.worker.bundle.js';
        }
    };

    require(['vs/editor/editor.main'], function() {
        // Define custom themes before creating editor
        defineCustomThemes(monaco);

        const initialTheme = getPreference('editorTheme') || 'vs-dark';
        const initialMinimap = getPreference('minimapEnabled') === 'true'; // Default false

        editor = monaco.editor.create(editorContainer, {
            value: '',
            language: 'plaintext',
            theme: initialTheme,
            automaticLayout: true,
            minimap: { enabled: initialMinimap }
        });

        // Setup Settings Controls
        setupSettingsControls(initialTheme, initialMinimap);

        // Load initial tab
        openOrSwitchTab('welcome.txt', 'Welcome', 'plaintext', getSampleContent('welcome.txt'));

        // Ensure layout updates when switching sections
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class' && editor) {
                    const editorSection = document.getElementById('editor-section');
                    if (editorSection.classList.contains('active-section')) {
                         // Use a small timeout to ensure layout is recalculated
                         setTimeout(() => editor.layout(), 50);
                    }
                    break;
                }
            }
        });
        observer.observe(document.getElementById('editor-section'), { attributes: true });
        observer.observe(document.getElementById('settings-section'), { attributes: true });


    }); // End require callback


    // --- Section/View Switching ---
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = link.dataset.section;
            if (!targetSectionId) return;

            // Update active link style
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Switch visible section
            sections.forEach(section => {
                if (section.id === `${targetSectionId}-section`) {
                    section.classList.add('active-section');
                } else {
                    section.classList.remove('active-section');
                }
            });

             // Update header title based on active link (optional)
             const headerTitle = document.querySelector('.content-header h1');
             if(headerTitle) {
                headerTitle.textContent = link.textContent.trim();
             }

        });
    });


    // --- Tab Management (Similar to previous example) ---
    function renderTabs() {
        tabBar.innerHTML = ''; // Clear existing tabs
        openTabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
            tabElement.dataset.tabId = tab.id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = tab.name;
            tabElement.appendChild(nameSpan);

            const closeButton = document.createElement('span');
            closeButton.className = 'tab-close';
            closeButton.innerHTML = '×';
            closeButton.title = 'Close Tab';
            tabElement.appendChild(closeButton);

            // Click on tab body to switch
            tabElement.addEventListener('click', (e) => {
                if (e.target !== closeButton) {
                   switchTab(tab.id);
                }
            });

            // Click close button
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(tab.id);
            });

            tabBar.appendChild(tabElement);
        });
    }

     function openOrSwitchTab(id, name, language = 'plaintext', content = '') {
        const existingTabIndex = openTabs.findIndex(tab => tab.id === id);

        if (existingTabIndex > -1) {
            switchTab(id);
        } else {
            saveCurrentViewState(); // Save state before switching/opening
            const newTab = { id, name, content, language, viewState: null };
            openTabs.push(newTab);
            activeTabId = id;
            renderTabs();
            updateEditorContent(newTab);
        }
    }

    function switchTab(tabId) {
        if (tabId === activeTabId || !editor) return;
        saveCurrentViewState(); // Save state of the old tab
        const newActiveTab = openTabs.find(tab => tab.id === tabId);
        if (!newActiveTab) return;
        activeTabId = tabId;
        updateEditorContent(newActiveTab); // Load new content/state
        renderTabs(); // Update visual active state
    }

     function closeTab(tabId) {
        const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1) return;

        openTabs.splice(tabIndex, 1); // Remove tab data

        if (activeTabId === tabId) { // If closing the active tab
            if (openTabs.length > 0) {
                const newActiveIndex = Math.max(0, tabIndex - 1); // Go to previous or first
                activeTabId = openTabs[newActiveIndex].id;
                updateEditorContent(openTabs[newActiveIndex]);
            } else { // No tabs left
                activeTabId = null;
                if (editor) editor.getModel()?.setValue(''); // Clear editor
            }
        }
         // If closing non-active, activeTabId remains, just re-render
        renderTabs();
    }

    function saveCurrentViewState() {
        if (activeTabId && editor) {
            const currentTab = openTabs.find(tab => tab.id === activeTabId);
            if (currentTab) {
                currentTab.viewState = editor.saveViewState();
                currentTab.content = editor.getValue(); // Also save content
            }
        }
    }

    function updateEditorContent(tabData) {
        if (!editor || !tabData) return;

        // Use models to avoid re-creating content unnecessarily
        const modelUri = monaco.Uri.parse(`inmemory://model/${tabData.id}`);
        let model = monaco.editor.getModel(modelUri);

        if (!model) {
            model = monaco.editor.createModel(tabData.content, tabData.language, modelUri);
        } else {
             // Ensure content is up-to-date if model already existed but wasn't active
             if(model.getValue() !== tabData.content) {
                model.setValue(tabData.content);
             }
        }

        editor.setModel(model);

        if (tabData.viewState) {
            editor.restoreViewState(tabData.viewState);
        }
        editor.focus();
    }

    function getSampleContent(filename) {
        // Add more samples if needed
        if (filename === 'welcome.txt') {
            return `Welcome to the Code Editor!

- Use the tabs above to switch files.
- Click the 'Settings' link in the sidebar to change themes or toggle the minimap.
- This editor uses the Monaco Editor, the engine behind VS Code.

Happy Coding!
`;
        }
        return `-- No content for ${filename}`;
    }

    // --- Settings Controls ---
    function setupSettingsControls(initialTheme, initialMinimap) {
        // Populate Theme Selector
        Object.keys(editorThemes).forEach(themeId => {
            const option = document.createElement('option');
            option.value = themeId;
            option.textContent = editorThemes[themeId].name;
            themeSelect.appendChild(option);
        });
        themeSelect.value = initialTheme; // Set initial value

        // Set initial Minimap state
        minimapToggle.checked = initialMinimap;

        // Add Event Listeners
        minimapToggle.addEventListener('change', () => {
            const enabled = minimapToggle.checked;
            if (editor) {
                editor.updateOptions({ minimap: { enabled: enabled } });
            }
            savePreference('minimapEnabled', enabled);
        });

        themeSelect.addEventListener('change', () => {
            const selectedTheme = themeSelect.value;
            if (editor && editorThemes[selectedTheme]) {
                monaco.editor.setTheme(selectedTheme);
                savePreference('editorTheme', selectedTheme);
            }
        });
    }

     // --- Local Storage Preferences ---
    function savePreference(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn("Could not save preference to localStorage:", e);
        }
    }

    function getPreference(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("Could not read preference from localStorage:", e);
            return null;
        }
    }

     // --- Define Custom Monaco Themes ---
    function defineCustomThemes(monacoInstance) {
        // Define Nord (Example)
        monacoInstance.editor.defineTheme('nord', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '616E88' }, // Nord4
                { token: 'string', foreground: 'A3BE8C' }, // Nord14
                { token: 'number', foreground: 'B48EAD' }, // Nord15
                { token: 'keyword', foreground: '81A1C1' }, // Nord9
                { token: 'type', foreground: '88C0D0' }, // Nord8
                { token: 'identifier', foreground: 'D8DEE9' }, // Nord6 (Default text)
                { token: 'delimiter', foreground: '81A1C1' }, // Nord9
                { token: 'operator', foreground: '81A1C1' }, // Nord9
                { token: 'tag', foreground: '81A1C1' },         // Nord9 (HTML tags)
                { token: 'attribute.name', foreground: '8FBCBB' }, // Nord7
                { token: 'attribute.value', foreground: 'A3BE8C' },// Nord14 (String color)
                { token: 'variable', foreground: 'D8DEE9'},        // Nord6
                { token: 'variable.parameter', foreground: '88C0D0'}, // Nord8
                { token: 'function', foreground: '88C0D0' },     // Nord8
            ],
            colors: {
                'editor.foreground': '#D8DEE9',         // Nord6
                'editor.background': '#2E3440',         // Nord0
                'editor.selectionBackground': '#434C5E', // Nord3
                'editor.lineHighlightBackground': '#3B4252', // Nord1
                'editorCursor.foreground': '#D8DEE9',     // Nord6
                'editorWhitespace.foreground': '#4C566A', // Nord3 dimmed
                'editorIndentGuide.background': '#4C566A',
                'editorIndentGuide.activeBackground': '#5E81AC', // Nord10
                'sideBar.background': '#2E3440',        // Nord0
                'sideBar.foreground': '#D8DEE9',
                'sideBarSectionHeader.background': '#3B4252', // Nord1
                 'activityBar.background': '#2E3440',     // Nord0
                 'minimap.background': '#2E3440'          // Ensure minimap bg matches
            }
        });

         // Define Monokai (Example)
        monacoInstance.editor.defineTheme('monokai', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '75715E' },
                { token: 'string', foreground: 'E6DB74' },
                { token: 'number', foreground: 'AE81FF' },
                { token: 'keyword', foreground: 'F92672' },
                { token: 'operator', foreground: 'F92672' },
                { token: 'identifier', foreground: 'A6E22E' }, // Functions, variables
                { token: 'type', foreground: '66D9EF' }, // Types, classes
                { token: 'tag', foreground: 'F92672' }, // HTML/XML tags
                { token: 'attribute.name', foreground: 'A6E22E' },
                { token: 'attribute.value', foreground: 'E6DB74' },
                { token: 'variable', foreground: 'FD971F' }, // Special variables like 'this'
            ],
            colors: {
                'editor.background': '#272822',
                'editor.foreground': '#F8F8F2',
                'editor.selectionBackground': '#49483E',
                'editor.lineHighlightBackground': '#3E3D32',
                'editorCursor.foreground': '#F8F8F0',
                'editorWhitespace.foreground': '#3B3A32',
                'editorIndentGuide.background': '#3B3A32',
                'editorIndentGuide.activeBackground': '#9D550F',
                 'minimap.background': '#272822' // Ensure minimap bg matches
            }
        });

        // --- ADD MORE THEME DEFINITIONS HERE ---
        // Find definitions online for Solarized, Dracula, GitHub themes etc.
        // Search for "monaco editor theme definitions" or "convert vscode theme to monaco"

        // Placeholder for Solarized Dark
        monacoInstance.editor.defineTheme('solarized-dark', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#002b36', 'minimap.background': '#002b36'} });
        // Placeholder for Solarized Light
        monacoInstance.editor.defineTheme('solarized-light', { base: 'vs', inherit: true, rules: [], colors: {'editor.background': '#fdf6e3', 'minimap.background': '#fdf6e3'} });
        // Placeholder for GitHub Dark
        monacoInstance.editor.defineTheme('github-dark', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#0d1117', 'minimap.background': '#0d1117'} });
        // Placeholder for GitHub Light
        monacoInstance.editor.defineTheme('github-light', { base: 'vs', inherit: true, rules: [], colors: {'editor.background': '#ffffff', 'minimap.background': '#ffffff'} });
        // Placeholder for Dracula
        monacoInstance.editor.defineTheme('dracula', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#282a36', 'minimap.background': '#282a36'} });
        // Placeholder for Cobalt
        monacoInstance.editor.defineTheme('cobalt', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#002240', 'minimap.background': '#002240'} });
         // Placeholder for One Dark Pro
        monacoInstance.editor.defineTheme('one-dark-pro', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#282c34', 'minimap.background': '#282c34'} });
         // Placeholder for Material Darker
        monacoInstance.editor.defineTheme('material-darker', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#212121', 'minimap.background': '#212121'} });
         // Placeholder for Material Lighter
        monacoInstance.editor.defineTheme('material-lighter', { base: 'vs', inherit: true, rules: [], colors: {'editor.background': '#FAFAFA', 'minimap.background': '#FAFAFA'} });
         // Placeholder for Kimbie Dark
        monacoInstance.editor.defineTheme('kimbie-dark', { base: 'vs-dark', inherit: true, rules: [], colors: {'editor.background': '#221a0f', 'minimap.background': '#221a0f'} });


        console.log("Custom themes defined.");
    }


}); // End DOMContentLoaded
