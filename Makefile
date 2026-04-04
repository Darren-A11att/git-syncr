PREFIX      ?= /usr/local
PLIST_DIR   := $(HOME)/Library/LaunchAgents
LOG_DIR     := $(HOME)/Library/Logs/git-sync
PLIST_LABEL := com.user.git-sync
PLIST_FILE  := $(PLIST_DIR)/$(PLIST_LABEL).plist
SYNC_DIR    ?= $(HOME)/Development

.PHONY: install uninstall test

install:
	@# Install the git-sync script
	install -d $(PREFIX)/bin
	install -m 755 bin/git-sync $(PREFIX)/bin/git-sync
	@# Create log directory
	mkdir -p $(LOG_DIR)
	@# Generate plist from template with correct paths
	mkdir -p $(PLIST_DIR)
	sed -e 's|__HOME__|$(HOME)|g' \
	    -e 's|__SYNC_DIR__|$(SYNC_DIR)|g' \
	    -e 's|__PREFIX__|$(PREFIX)|g' \
	    launchd/$(PLIST_LABEL).plist > $(PLIST_FILE)
	@# Load the launchd agent
	launchctl load $(PLIST_FILE)
	@echo ""
	@echo "git-sync installed successfully."
	@echo "  Script:    $(PREFIX)/bin/git-sync"
	@echo "  Plist:     $(PLIST_FILE)"
	@echo "  Scan dir:  $(SYNC_DIR)"
	@echo "  Logs:      $(LOG_DIR)"
	@echo "  Interval:  every 24 hours"
	@echo ""
	@echo "Run 'git-sync --verbose' to test manually."
	@echo "Run 'launchctl start $(PLIST_LABEL)' to trigger immediately."

uninstall:
	@# Unload the launchd agent (ignore errors if not loaded)
	-launchctl unload $(PLIST_FILE) 2>/dev/null
	@# Remove plist and script
	rm -f $(PLIST_FILE)
	rm -f $(PREFIX)/bin/git-sync
	@echo ""
	@echo "git-sync uninstalled."
	@echo "Logs preserved at $(LOG_DIR)"

test:
	@# Run git-sync manually with verbose output
	GIT_SYNC_DIR=$(SYNC_DIR) bin/git-sync --verbose
