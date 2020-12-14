module.exports = {
    inputDir: 'src',
    outputDir: 'dist',
    publicPath: '',
    devServer: {
        host: 'localhost',
        port: 8088
    },
    htmlBeautify: {
        indent_size: 4,
        indent_char: ' ',
        max_preserve_newlines: 2,
        preserve_newlines: true,
        keep_array_indentation: false,
        break_chained_methods: false,
        indent_scripts: 'normal',
        brace_style: 'collapse',
        space_before_conditional: true,
        unescape_strings: false,
        jslint_happy: false,
        end_with_newline: false,
        wrap_line_length: '0',
        indent_inner_html: false,
        comma_first: false,
        e4x: false,
        indent_empty_lines: false
    },
    metaPath: 'src/data/meta.json',
    breakpoints: {
        mobile: 375,
        tablet: 768,
        desktop: 1250,
    }
};
