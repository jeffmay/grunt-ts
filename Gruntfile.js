module.exports = function (grunt) {
    "use strict";

    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        watch: {
            /*
             * watch and compile typescript to javascript
             */
            typescript: {
                files: ['test/work/**/*.ts'],
                tasks: ['ts:normal']
            }
        },

        clean: {
            test: [
                "test/**/*.js",
            ]
        },

        ts: {
            normal: {
                src: ["test/work/**/*.ts"],                
                reference: "./test/", // If specified, generate a reference.ts file at this place, Automatically manages relative file paths                
                out: 'test/out.js', // If specified, generate a out.js file which is the merged typescript output                
            },
            fail: {
                src: ["test/fail/*.ts"],                
            },
            watch: {
                src: ["test/work/**/*.ts"],                
                reference: "test/", // If specified, generate a reference.ts file at this place, Automatically manages relative file paths                
                out: 'test/out.js', // If specified, generate a out.js file which is the merged typescript output                
                watch: 'test'
            },
        },
    });

    grunt.loadTasks("tasks");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.registerTask("test", ["clean", "ts"]);
    grunt.registerTask("default", ["test"]);

};