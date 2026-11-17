#!/bin/zsh
cd -- "${0:A:h}"
printf 'Transformer Twin 3D\nOpen http://127.0.0.1:4174 in your browser.\nPress Control-C to stop the preview.\n\n'
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
