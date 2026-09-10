// ==========================================================================
// Diablo 3 / RPG Modular Layout Engine
// ==========================================================================

(() => {
  // ------------------------------------------------------------------------
  // 1. Storage Keys & Defaults
  // ------------------------------------------------------------------------
  const STORAGE_THEME = 'preferred-theme';
  const STORAGE_LAYOUT = 'card-layout-v10';

  const DEFAULT_LAYOUT = {
    'col-main': ['card-research', 'card-projects', 'card-jobs', 'card-achievements', 'card-extra'],
    'col-sidebar': ['card-experience', 'card-contact', 'card-discussions']
  };

  // ------------------------------------------------------------------------
  // 2. Theme Toggle Engine (Icon Only) & Giscus Theme Synchronizer
  // ------------------------------------------------------------------------
  const themeBtn = document.getElementById('theme-toggle');

  const updateGiscusTheme = (theme) => {
    const iframe = document.querySelector('iframe.giscus-frame');
    if (!iframe) return;
    iframe.contentWindow.postMessage(
      { giscus: { setConfig: { theme: theme === 'dark' ? 'dark' : 'light' } } },
      'https://giscus.app'
    );
  };

  const getInitialTheme = () => {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeBtn) {
        themeBtn.innerHTML = '<span class="theme-icon" aria-hidden="true">☀️</span>';
        themeBtn.setAttribute('title', 'Switch to light theme');
        themeBtn.setAttribute('aria-label', 'Switch to light theme');
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeBtn) {
        themeBtn.innerHTML = '<span class="theme-icon" aria-hidden="true">🌙</span>';
        themeBtn.setAttribute('title', 'Switch to dark theme');
        themeBtn.setAttribute('aria-label', 'Switch to dark theme');
      }
    }
    updateGiscusTheme(theme);
  };

  applyTheme(getInitialTheme());

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      localStorage.setItem(STORAGE_THEME, next);
      applyTheme(next);
    });
  }

  // ------------------------------------------------------------------------
  // 5. Drag & Drop Inventory System
  // ------------------------------------------------------------------------
  const columns = document.querySelectorAll('.inventory-column');
  let draggedItem = null;
  let wasDragging = false;
  let placeholder = document.createElement('div');
  placeholder.className = 'drop-placeholder';

  const saveLayout = () => {
    const layout = {};
    columns.forEach((col) => {
      const colId = col.dataset.columnId;
      const itemIds = Array.from(col.querySelectorAll('.inventory-item'))
        .map((item) => item.dataset.itemId)
        .filter(Boolean);
      layout[colId] = itemIds;
    });
    localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout));
  };

  const restoreLayout = () => {
    const saved = localStorage.getItem(STORAGE_LAYOUT);
    let layout = DEFAULT_LAYOUT;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const domCardIds = Array.from(document.querySelectorAll('.inventory-item')).map(
          (el) => el.dataset.itemId
        );
        const savedIds = Object.values(parsed).flat();

        // Valid if it contains all current DOM cards and both columns are non-empty
        const isValid =
          parsed['col-main'] &&
          parsed['col-sidebar'] &&
          parsed['col-sidebar'].length > 0 &&
          domCardIds.every((id) => savedIds.includes(id));

        if (isValid) {
          layout = parsed;
        } else {
          localStorage.removeItem(STORAGE_LAYOUT);
          layout = DEFAULT_LAYOUT;
        }
      } catch (e) {
        layout = DEFAULT_LAYOUT;
      }
    }

    columns.forEach((col) => {
      const colId = col.dataset.columnId;
      const itemIds = layout[colId];
      if (Array.isArray(itemIds)) {
        itemIds.forEach((id) => {
          const item = document.querySelector(`[data-item-id="${id}"]`);
          if (item) {
            col.appendChild(item);
          }
        });
      }
    });
  };

  // Attach Drag Listeners to Items (Drag ONLY when dragging from .drag-handle)
  const setupDragItem = (item) => {
    // Default draggable to false so text selection and copying work anywhere inside the card
    item.setAttribute('draggable', 'false');

    const handles = item.querySelectorAll('.drag-handle');
    handles.forEach((handle) => {
      handle.addEventListener('mousedown', () => {
        item.setAttribute('draggable', 'true');
      });
      handle.addEventListener('touchstart', () => {
        item.setAttribute('draggable', 'true');
      }, { passive: true });
    });

    const resetDraggable = () => {
      if (!draggedItem) {
        item.setAttribute('draggable', 'false');
      }
    };

    window.addEventListener('mouseup', resetDraggable);
    window.addEventListener('touchend', resetDraggable);

    item.addEventListener('dragstart', (e) => {
      // If drag was not initiated by the handle, abort immediately to allow native text selection
      if (item.getAttribute('draggable') !== 'true') {
        e.preventDefault();
        return;
      }

      draggedItem = item;
      wasDragging = true;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.itemId);

      // Height sync for placeholder
      placeholder.style.height = `${item.offsetHeight}px`;

      // Timeout allows drag preview image to render before applying opacity
      setTimeout(() => {
        item.classList.add('is-dragging');
      }, 0);
    });

    item.addEventListener('dragend', () => {
      item.setAttribute('draggable', 'false');
      if (draggedItem) {
        draggedItem.classList.remove('is-dragging');
      }
      if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      document.querySelectorAll('.inventory-item').forEach((el) => el.classList.remove('drag-over'));
      draggedItem = null;
      setTimeout(() => {
        wasDragging = false;
      }, 50);
      saveLayout();
    });
  };

  document.querySelectorAll('.inventory-item').forEach(setupDragItem);

  // Setup Column Drop Zones
  columns.forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedItem) return;

      const afterElement = getDragAfterElement(col, e.clientY);
      if (afterElement == null) {
        col.appendChild(placeholder);
      } else {
        col.insertBefore(placeholder, afterElement);
      }
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!draggedItem) return;

      if (placeholder.parentNode === col) {
        col.insertBefore(draggedItem, placeholder);
      } else {
        col.appendChild(draggedItem);
      }

      if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }

      draggedItem.classList.remove('is-dragging');
      saveLayout();
    });
  });

  // Calculate position between items
  const getDragAfterElement = (container, y) => {
    const draggableElements = [
      ...container.querySelectorAll('.inventory-item:not(.is-dragging)')
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  };

  // ------------------------------------------------------------------------
  // 6. Reset Layout Action
  // ------------------------------------------------------------------------
  const resetBtn = document.getElementById('reset-inventory-btn');

  const resetToDefaultLayout = () => {
    localStorage.removeItem(STORAGE_LAYOUT);

    const sidebarCol = document.querySelector('[data-column-id="col-sidebar"]');
    const mainCol = document.querySelector('[data-column-id="col-main"]');

    if (sidebarCol && mainCol) {
      DEFAULT_LAYOUT['col-main'].forEach((id) => {
        const el = document.querySelector(`[data-item-id="${id}"]`);
        if (el) mainCol.appendChild(el);
      });

      DEFAULT_LAYOUT['col-sidebar'].forEach((id) => {
        const el = document.querySelector(`[data-item-id="${id}"]`);
        if (el) sidebarCol.appendChild(el);
      });
    }

    chips.forEach((c) => c.classList.remove('is-active'));
    saveLayout();
  };

  if (resetBtn) {
    resetBtn.addEventListener('click', resetToDefaultLayout);
  }

  // ------------------------------------------------------------------------
  // 7. Section Chips (Click to Move to Top of Main Feed & Balance Columns)
  // ------------------------------------------------------------------------
  const chips = document.querySelectorAll('.section-chip');
  const mainCol = document.querySelector('[data-column-id="col-main"]');
  const sidebarCol = document.querySelector('[data-column-id="col-sidebar"]');

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const targetId = chip.dataset.target;
      const targetCard = document.getElementById(targetId);

      if (targetCard && mainCol && sidebarCol) {
        // Highlight active chip
        chips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');

        // If clicking + Extra chip, expand extra card if collapsed
        if (targetId === 'card-extra' && extraCard && extraCard.classList.contains('is-collapsed')) {
          setExtraCollapsed(false);
        }

        // Check if target was originally in the sidebar column
        const wasInSidebar = targetCard.parentElement === sidebarCol;

        // Move selected card to the very top of the main showcase column
        mainCol.insertBefore(targetCard, mainCol.firstChild);

        // If target was moved from sidebar to main, dynamically move an unselected card
        // from the bottom of main column to sidebar so the smaller column never becomes empty!
        if (wasInSidebar) {
          const mainCards = Array.from(mainCol.querySelectorAll('.inventory-item')).filter(
            (item) => item !== targetCard
          );
          if (mainCards.length >= 3) {
            const cardToMoveToSidebar = mainCards[mainCards.length - 1];
            sidebarCol.insertBefore(cardToMoveToSidebar, sidebarCol.firstChild);
          }
        }

        // Safeguard: Ensure sidebar never stays empty (self-healing for prior states)
        const currentSidebarCards = sidebarCol.querySelectorAll('.inventory-item');
        if (currentSidebarCards.length === 0) {
          const mainCards = Array.from(mainCol.querySelectorAll('.inventory-item')).filter(
            (item) => item !== targetCard
          );
          while (mainCards.length > 2) {
            const cardToMove = mainCards.pop();
            sidebarCol.appendChild(cardToMove);
          }
        }

        // Trigger visual promotion animation
        targetCard.classList.remove('is-promoted');
        void targetCard.offsetWidth; // force reflow
        targetCard.classList.add('is-promoted');

        saveLayout();

        // Smoothly scroll into view if needed
        const rect = targetCard.getBoundingClientRect();
        if (rect.top < 80 || rect.top > window.innerHeight - 150) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // ------------------------------------------------------------------------
  // 8. Collapsible Extra Section & Sub-Box Filter Tabs
  // ------------------------------------------------------------------------
  const extraCard = document.getElementById('card-extra');
  const toggleExtraBtn = document.getElementById('toggle-extra-btn');
  const extraTriggerBox = document.getElementById('extra-trigger-box');

  const setExtraCollapsed = (collapsed) => {
    if (!extraCard) return;
    if (collapsed) {
      extraCard.classList.add('is-collapsed');
      if (extraTriggerBox) extraTriggerBox.setAttribute('aria-expanded', 'false');
      if (toggleExtraBtn) toggleExtraBtn.setAttribute('aria-expanded', 'false');
    } else {
      extraCard.classList.remove('is-collapsed');
      if (extraTriggerBox) extraTriggerBox.setAttribute('aria-expanded', 'true');
      if (toggleExtraBtn) toggleExtraBtn.setAttribute('aria-expanded', 'true');
    }
  };

  if (extraTriggerBox) {
    extraTriggerBox.addEventListener('click', (e) => {
      if (wasDragging) return;
      if (e.target.closest('.drag-handle')) return;
      setExtraCollapsed(false);
    });

    extraTriggerBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExtraCollapsed(false);
      }
    });
  }

  if (toggleExtraBtn) {
    toggleExtraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setExtraCollapsed(true);
    });
  }

  // Sub-box filter buttons: [All] [Skills] [Achievements] [Conferences & Talks]
  const filterBtns = document.querySelectorAll('.extra-filter-btn');
  const subBoxes = document.querySelectorAll('.extra-sub-box');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      filterBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      subBoxes.forEach((box) => {
        const tab = box.dataset.extraTab;
        if (filter === 'all' || filter === tab) {
          box.style.display = '';
        } else {
          box.style.display = 'none';
        }
      });
    });
  });

  // ------------------------------------------------------------------------
  // 9. Expandable Entry Descriptions (+ / −)
  // ------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('.desc-toggle-btn');
    if (toggleBtn) {
      e.stopPropagation();
      const parent = toggleBtn.closest('li') || toggleBtn.closest('.inventory-item');
      if (!parent) return;

      const desc = parent.querySelector('.entry-desc');
      if (!desc) return;

      const isCollapsed = desc.classList.contains('is-collapsed');
      if (isCollapsed) {
        desc.classList.remove('is-collapsed');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.setAttribute('title', 'Collapse description');
        toggleBtn.textContent = '−';
      } else {
        desc.classList.add('is-collapsed');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('title', 'Expand description');
        toggleBtn.textContent = '+';
      }
    }
  });

  // Restore saved arrangement on initial load
  restoreLayout();
})();
