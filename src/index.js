/*eslint no-console: 0 */

import async from 'async'
import { Buffer } from 'buffer'
import path from 'path'
import chalk from 'chalk'
import toJSON from 'shp2json'
import plural from 'plural'
import defaultsDeep from 'lodash.defaultsdeep'
import once from 'once'
import config from './defaultConfig'
import getRethink from './getRethink'
import saveBoundary from './saveBoundary'

const http = require('http');
const url = require('url');

export default (overrides, cb) => {
    cb = once(cb)
    const options = defaultsDeep({}, overrides, config)

    console.log(chalk.bold('Establishing connections:'))
    console.log(`  -- ${chalk.cyan(`RethinkDB @ ${options.rethink.db}`)}`)

    getConnections(options, (err, conns) => {
        if (err) return cb(err)
        const context = {
            ...conns,
            options
        }

        async.forEachSeries(Object.keys(options.objects), processObject.bind(null, context), cb)
    })
}

function getConnections(options, cb) {
    cb = once(cb)
    async.parallel({
        rethink: getRethink.bind(null, options.rethink)
    }, cb)
}

function processObject(context, object, cb) {
    cb = once(cb)
    fetchObjectFiles(context, object, (err, filePaths) => {
        if (err) return cb(err)
        console.log(chalk.bold(`Processing ${filePaths.length} boundary ${plural('file', filePaths.length)} for ${object}`))
        async.forEachSeries(filePaths, processFilePath.bind(null, context), cb)
    })
}

function processFilePath(context, file_url, cb) {
    cb = once(cb)

    console.log(`  -- downloading ${chalk.cyan(file_url)}`)

    const file = url.parse(file_url)
    http.get(file, (response) => {
        const srcStream = toJSON(response)
        const chunks = []

        srcStream.on('data', (data) => {
            chunks.push(data)
        })

        srcStream.once('error', (err) => cb(err))
        srcStream.once('end', () => {
            const docs = JSON.parse(Buffer.concat(chunks)).features
            console.log(`  -- ${chalk.cyan(`Parsed ${file.path}, inserting ${docs.length} boundaries now...`)}`)
            async.forEachSeries(docs, saveBoundary.bind(null, context), cb)
        })
    })
}

function fetchObjectFiles(context, object, cb) {
    cb = once(cb);
    const newList = context.options.objects[object];
    cb(null, newList)
}
