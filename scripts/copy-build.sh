#!/bin/bash

# Create p directory if it does not exist
[ ! -d "./p" ] && mkdir p

# Iterate over all directories in ./plugins
for d in ./plugins/*/; do
    # Check if a dist directory exists for the current plugin
    if [ -d "${d}dist" ]; then
        # Extract the name of the plugin directory
        plugin_dir_name=$(basename "${d}")
        # Create plugin directory in p if it does not exist
        [ ! -d "./p/${plugin_dir_name}" ] && mkdir -p "./p/${plugin_dir_name}"
        # Copy all files from the dist directory to the target directory
        cp -r "${d}dist"/* "./p/${plugin_dir_name}/"
    else
        echo $d does not have a dist directory
    fi
done