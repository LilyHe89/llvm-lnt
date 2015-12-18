"""Asynchrounus operations for LNT.

For big tasks it is nice to be able to run in the backgorund.  This module
contains wrappers to run particular LNT tasks in subprocesess. 

Because multiprocessing cannot directly use the LNT test-suite objects in
subprocesses (because they are not serializable because they don't have a fix
package in the system, but are generated on program load) we recreate the test
suite that we need inside each subprocess before we execute the work job.
"""
import logging
from flask import current_app
import sys
import lnt.server.db.fieldchange as fieldchange
import lnt.server.db.v4db
import traceback
import multiprocessing
from multiprocessing import Pool, TimeoutError
from lnt.testing.util.commands import note
NUM_WORKERS = 2  # The number of subprocesses to spawn per LNT process.
WORKERS = None  # The worker pool.


def launch_workers():
    """Make sure we have a worker pool ready to queue."""
    global WORKERS
    if not WORKERS:
        logger = multiprocessing.log_to_stderr()
        logger.setLevel(logging.INFO)
        note("Starting workers")
        WORKERS = Pool(NUM_WORKERS)


def async_fieldchange_calc(ts, run):
    """Run regenerate field changes in the background."""
    func_args = {'run_id': run.id}
    #  Make sure this run is in the database!
    ts.commit()
    async_run_job(fieldchange.regenerate_fieldchanges_for_run,
                  ts,
                  func_args)


def async_run_job(job, ts, func_args):
    """Send a job to the async wrapper in the subprocess."""
    # If the run is not in the database, we can't do anything more.
    note("Queuing background job to process fieldchanges")
    args = {'tsname': ts.name,
            'db': ts.v4db.settings()}
    launch_workers()
    job = WORKERS.apply_async(async_wrapper,
                              [job, args, func_args],
                              callback=async_job_finished)
    # Lets see if we crash right away?
    try:
        job.get(timeout=1)
    except TimeoutError:
        pass


def async_wrapper(job, ts_args, func_args):
    """Setup test-suite in this subprocess and run something.
    
    Because of multipocessing, capture excptions and log messages,
    and return them.
    """
    try:
        print >>sys.stderr,"Test"
        h = logging.handlers.MemoryHandler(1024 * 1024)
        h.setLevel(logging.DEBUG)
        logging.getLogger('LNT').addHandler(h)
        note("Running async wrapper: {}".format(job.__name__))
        _v4db = lnt.server.db.v4db.V4DB(**ts_args['db'])
        ts = _v4db.testsuite[ts_args['tsname']]
        job(ts, **func_args)
    except:
        # Put all exception text into an exception and raise that for our
        # parent process.
        return Exception("".join(traceback.format_exception(*sys.exc_info())))
    return h.buffer


def async_job_finished(arg):
    if isinstance(arg, Exception):
        raise arg
    if isinstance(arg, list):
        for log_entry in arg:
            logging.getLogger('LNT').handle(log_entry)
    
