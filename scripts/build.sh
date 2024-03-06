mkdir p
for dir in plugins/*/
do
    dir=${dir%*/}
    build_dir=${dir##*/}  
    echo "Processing $dir"
    cd "${dir}"
    
    mkdir "../../p/${build_dir}"
    cp -R dist/* "../../p/${build_dir}"
    cd -  # return to root directory
done