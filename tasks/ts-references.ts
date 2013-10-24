/// <reference path="../defs/node/node.d.ts"/>
/// <reference path="../defs/grunt/grunt.d.ts"/>
/// <reference path="../defs/underscore.string/underscore.string.d.ts"/>

import _ = require('underscore');
import _str = require('underscore.string');
import fs = require('fs');
import os = require('os');
import path = require('path');

// TODO: Update this
interface ITaskOptions {
    target: string; // es3 , es5
    module: string; // amd, commonjs
    sourcemap: boolean;
    declaration: boolean;
    comments: boolean;
    verbose: boolean;
}


interface ICompileResult {
    code: number;
    output: string;
}

interface ITargetOptions {
    src: string[]; // input files  // Note : this is a getter and returns a new "live globbed" array
    reference: string; // path to a reference.ts e.g. './approot/'
    out: string; // if sepecified e.g. 'single.js' all output js files are merged into single.js using tsc --out command
    outDir: string; // if sepecified e.g. '/build/js' all output js files are put in this location
    html: string[];  // if specified this is used to generate typescript files with a single variable which contains the content of the html
    watch: string; // if specified watches all files in this directory for changes.
    amdloader: string;  // if specified creates a js file to load all the generated typescript files in order using requirejs + order
}

var eol = os.EOL;

enum referenceFileLoopState { before, unordered, after };

// General util functions
function insertArrayAt(array: string[], index: number, arrayToInsert: string[]) {
    Array.prototype.splice.apply(array, [index, 0].concat(arrayToInsert));
    return array;
}

// Useful string functions
// used to make sure string ends with a slash
function endsWith(str: string, suffix: string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function pluginFn(grunt: IGrunt) {

    /////////////////////////////////////////////////////////////////////
    // Reference file logic
    ////////////////////////////////////////////////////////////////////

    // Converts "C:\boo" , "C:\boo\foo.ts" => "./foo.ts"; Works on unix as well.
    function makeReferencePath(folderpath: string, filename: string) {
        return path.relative(folderpath, filename).split('\\').join('/');
    }

    // Updates the reference file
    function updateReferenceFile(files: string[], referenceFile: string, referencePath: string) {
        var referenceIntro = '/// <reference path="';
        var referenceEnd = '" />';
        var referenceMatch = /\/\/\/ <reference path=\"(.*?)\"/;
        var ourSignatureStart = '//grunt-start';
        var ourSignatureEnd = '//grunt-end';

        var origFileLines = []; // The lines we do not modify and send out as is. Lines will we reach grunt-ts generated
        var origFileReferences = []; // The list of files already there that we do not need to manage

        // Location of our generated references
        // By default at start of file
        var signatureSectionPosition = 0;

        // Read the original file if it exists
        if (fs.existsSync(referenceFile)) {
            var lines = fs.readFileSync(referenceFile).toString().split('\n');

            var inSignatureSection = false;

            // By default our signature goes at end of file
            signatureSectionPosition = lines.length;

            for (var i = 0; i < lines.length; i++) {

                var line = _str.trim(lines[i]);

                // Skip logic for our generated section
                if (_str.include(line, ourSignatureStart)) {
                    //Wait for the end signature:
                    signatureSectionPosition = i;
                    inSignatureSection = true;
                    continue;
                }
                if (_str.include(line, ourSignatureEnd)) {
                    inSignatureSection = false;
                    continue;
                }
                if (inSignatureSection) continue;

                // store the line
                origFileLines.push(line);

                // Fetch the existing reference's filename if any:
                if (_str.include(line, referenceIntro)) {
                    var match = line.match(referenceMatch);
                    var filename = match[1];
                    origFileReferences.push(filename);
                }
            }
        }

        var contents = [ourSignatureStart];

        // Put in the new / observed missing files:
        files.forEach((filename: string) => {
            // The file we are about to add
            var filepath = makeReferencePath(referencePath, filename);

            // If there are orig references
            if (origFileReferences.length) {
                if (_.contains(origFileReferences, filepath)) {
                    return;
                }
            }

            // Finally add the filepath
            contents.push(referenceIntro + filepath + referenceEnd);
        });
        contents.push(ourSignatureEnd);

        // Modify the orig contents to put in our contents
        origFileLines = insertArrayAt(origFileLines, signatureSectionPosition, contents);
        fs.writeFileSync(referenceFile, origFileLines.join(eol));
    }

    /////////////////////////////////////////////////////////////////////
    // The grunt task
    ////////////////////////////////////////////////////////////////////

    // Note: this funciton is called once for each target
    // so task + target options are a bit blurred inside this function
    grunt.registerMultiTask('ts', 'Generate TypeScript reference file', function() {

        var currenttask: ITask = this;

        // Was the whole process successful
        var success = true;

        // Some interesting logs:
        //http://gruntjs.com/api/inside-tasks#inside-multi-tasks
        //console.log(this)
        //console.log(this.files[0]); // An array of target files ( only one in our case )
        //console.log(this.files[0].src); // a getter for a resolved list of files
        //console.log(this.files[0].orig.src); // The original glob / array / !array / <% array %> for files. Can be very fancy :)

        // this.files[0] is actually a single in our case as we gave examples of  one source / out per target
        this.files.forEach(function (target: ITargetOptions) {

            // TODO: We can assume this
            // Create a reference file?
            var reference = target.reference;
            var referenceFile;
            var referencePath;
            if (!!reference) {
                referenceFile = path.resolve(reference);
                referencePath = path.dirname(referenceFile)
            }
            function isReferenceFile(filename: string) {
                return path.resolve(filename) == referenceFile;
            }


            // TODO: name this better
            // Generate reference file
            function runCompilation(files: string[]) {
                var starttime: number, endtime: number;

                grunt.log.writeln('Compiling.'.yellow);

                // Time the task and go
                starttime = new Date().getTime();

                // Create a reference file if specified
                if (!!referencePath) {
                    updateReferenceFile(files, referenceFile, referencePath);
                }

                // End the timer
                endtime = new Date().getTime();

                var time = (endtime - starttime) / 1000;
                grunt.log.writeln(('Success: ' + time.toFixed(2) + 's to update reference file').green);
            }

            // TODO: Name this better
            function filterFilesAndCompile() {

                // Reexpand the original file glob:
                var files = grunt.file.expand(currenttask.data.src);

                // ignore directories
                files = files.filter((file) => {
                    var stats = fs.lstatSync(file);
                    !stats.isDirectory();
                });

                // Clear the files of output.d.ts and reference.ts
                files = files.filter((filename) => {
                    !isReferenceFile(filename)
                    // TODO:
//                    && !isOutFile(filename);
                });

                runCompilation(files);
            }

            // Initial compilation:
            filterFilesAndCompile();
        });



        return success;
    });
}

export = pluginFn;