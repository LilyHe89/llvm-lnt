//////////////////////////////////////////////////////////////////////
// This script provides the functionality for the LNT profile page
// (v4_profile.html).


function Profile(element, runid, testid, unique_id) {
    this.element = $(element);
    this.runid = runid;
    this.testid = testid;
    this.unique_id = unique_id;
    this.function_name = null;
    $(element).html('<center><i>Select a run and function above<br> ' +
                    'to view a performance profile</i></center>');
}

Profile.prototype = {
    reset: function() {
        $(this.element).empty();
        $(this.element).html('<center><i>Select a run and function above<br> ' +
                             'to view a performance profile</i></center>');
    },
    go: function(function_name, counter_name) {
        this.counter_name = counter_name
        if (this.function_name != function_name)
            this._fetch_and_go(function_name);
        else
            this._go();
    },

    _fetch_and_go: function(fname, then) {
        this.function_name = fname;
        this_ = this;
        $.ajax(g_urls.getCodeForFunction, {
            dataType: "json",
            data: {'runid': this.runid, 'testid': this.testid,
                   'f': fname},
            success: function(data) {
                this_.data = data;
                this_._go();
            },
            error: function(xhr, textStatus, errorThrown) {
                pf_flash_error('accessing URL ' + g_urls.getCodeForFunction +
                               '; ' + errorThrown);
            }
        });
    },

    _go: function() {
        this.element.empty();
        for (i in this.data) {
            line = this.data[i];

            row = $('<tr></tr>');

            counter = this.counter_name;
            if (counter in line[0] && line[0][counter] > 0.0)
                row.append(this._labelTd(line[0][counter]));
            else
                row.append($('<td></td>'));

            address = line[1].toString(16);
            id = this.unique_id + address;
            a = $('<a id="' + id + '" href="#' + id + '"></a>').text(address);
            row.append($('<td></td>').addClass('address').append(a));
            row.append($('<td></td>').text(line[2]));
            this.element.append(row);
        }
    },

    _labelTd: function(value) {
        var labelPct = function(value) {
            // Colour scheme: Black up until 1%, then yellow fading to red at 10%
            var bg = '#fff';
            var hl = '#fff';
            if (value > 1.0 && value < 10.0) {
                hue = lerp(50.0, 0.0, (value - 1.0) / 9.0);
                bg = 'hsl(' + hue.toFixed(0) + ', 100%, 50%)';
                hl = 'hsl(' + hue.toFixed(0) + ', 100%, 30%)';
            } else if (value >= 10.0) {
                bg = 'hsl(0, 100%, 50%)';
                hl = 'hsl(0, 100%, 30%)';
            }
            return $('<td style="background-color:' + bg + '; border-right: 1px solid ' + hl + ';"></td>')
                .text(value.toFixed(2) + '%');
        }

        // FIXME: Implement absolute numbering.
        return labelPct(value);
    },
};

function StatsBar(element, testid) {
    this.element = $(element);
    this.runid = null;
    this.testid = testid;

    $(element).html('<center><i>Select one or two runs above ' +
                    'to view performance counters</i></center>');
}

StatsBar.prototype = {
    go: function (runids) {
        if (runids == this.runids)
            return;
        this.runids = runids;
        this.element.empty();
        var this_ = this;
        
        $.ajax(g_urls.getTopLevelCounters, {
            dataType: "json",
            data: {'runids': this.runids.join(), 'testid': this.testid},
            success: function(data) {
                var t = $('<table align="center" valign="middle"></table>');
                var r = $('<tr></tr>');
                var i = 0;
                for (counter in data) {
                    if (i > 0 && i % 4 == 0) {
                        t.append(r);
                        r = $('<tr></tr>');
                    }

                    var cell = this_._formatCell(counter, data[counter]);
                    r.append(cell);
                }
                if (r.children().length > 0)
                    t.append(r);
                this_.element.html(t);
            },
            error: function(xhr, textStatus, errorThrown) {
                pf_flash_error('accessing URL ' + g_urls.getTopLevelCounters +
                               '; ' + errorThrown);
            }
        });

    },

    _formatCell: function(counter, values) {
        if (values.length > 1) {
            // We have both counters, so we can compare them.
            var data1 = values[0];
            var data2 = values[1];
            percent = (data2 * 100.0 / data1) - 100.0;
            if (percent > 0.0) {
                // Make sure 2% is formatted as +2%.
                percent = '+' + percent.toFixed(2);
            } else if (percent < 0.0) {
                percent = percent.toFixed(2);
            }
            // FIXME: Add colors here.
            var element = '<th>'+counter+':</th>';
            element += '<td>' + add_commas(data1) + '<br>' + add_commas(data2);
            if (percent != 0.0)
                element += ' (' + percent + '%)';
            element += '</td>';
            return $(element);
        } else {
            var element = '<th>'+counter+':</th>';
            return $(element + '<td>' + add_commas(values[0]) + '</td>');
        }
    },
};

function RunTypeahead(element, options) {
    this.element = element;
    this.options = options;
    this.id = null;

    this_ = this;
    element.typeahead({
        source: function(query, process) {
            $.ajax(options.searchURL, {
                dataType: "json",
                data: {'q': query},
                success: function(data) {
                    process(data);
                },
                error: function(xhr, textStatus, errorThrown) {
                    pf_flash_error('accessing URL ' + options.searchURL +
                                   '; ' + errorThrown);
                }
            });
        },
        // These identity functions are required because the defaults
        // assume items are strings, whereas they're objects here.
        sorter: function(items) {
            // The results should be sorted on the server.
            return items;
        },
        matcher: function(item) {
            return item;
        },
        updater: function(item) {
            // FIXME: the item isn't passed in as json any more, it's
            // been rendered. Lame. To get around this, hack the
            // components of the 2-tuple back apart.
            name = item.split(',')[0];
            id = item.split(',')[1];
            this_.id = id;
            
            if (options.updated)
                options.updated(name, id);
            return name;
        },
        highlighter: function(item) {
            // item is a 2-tuple [name, obj].
            item = item[0];

            // This loop highlights each search term (split by space)
            // individually. The content of the for loop is lifted from
            // bootstrap.js (it's the original implementation of
            // highlighter()). In particular I have no clue what that regex
            // is doing, so don't bother asking.
            var arr = this.query.split(' ');
            for (i in arr) {
                query = arr[i];
                if (!query)
                    continue;
                var q = query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g,
                                          '\\$&')
                item = item.replace(new RegExp('(' + q + ')', 'ig'), function ($1, match) {
                    // We want to replace with <strong>match</strong here,
                    // but it's possible another search term will then
                    // match part of <strong>.
                    //
                    // Therefore, replace with two replaceable tokens that
                    // no search query is very likely to match...
                    return '%%%' + match + '£££'
                });
            }
            return item
                .replace(/%%%/g, '<strong>')
                .replace(/£££/g, '</strong>');
        }
    });
    // Bind an event disabling the function box and removing the profile
    // if the run box is emptied.
    element.change(function() {
        if (!element.val()) {
            this_.id = null;
            if (options.cleared)
                options.cleared();
        }
    });
}

RunTypeahead.prototype = {
    update: function (name, id) {
        this.element.val(name);
        this.id = id;
        if (this.options.updated)
            this.options.updated(name, id);
    },
    getSelectedRunId: function() {
        return this.id;
    }
};

function FunctionTypeahead(element, options) {
    this.element = element;
    this.options = options;
    var _this = this;
    
    element.typeahead({
            minLength: 0,
            items: 64,
        source: _this._source,
        matcher: function(item) {
            // This is basically the same as typeahead.matcher(), apart
            // from indexing into item[0] (as item is a 2-tuple
            //  [name, obj]).
            return item[0].toLowerCase().indexOf(this.query) > -1;
        },
        sorter: function(items) {
            // Sort items in descending order based on the value of the
            // current counter.

            c = options.getCounter();
            return items.sort(function(a, b) {
                // Note that this comparator needs to return -ve, 0, +ve,
                // NOT boolean. Therefore subtracting one from the other
                // gives the desired effect.
                var aval = -1; // Make sure undefined values get sorted
                var bval = -1; // to the end.
                if ('counters' in a[1] && c in a[1].counters) {
                    aval = a[1].counters[c];
                }  
                if ('counters' in b[1] && c in b[1].counters) {
                    bval = b[1].counters[c];
                }
                return bval - aval;
            });
            return items;
        },
        updater: function(item) {
            // FIXME: the item isn't passed in as json any more, it's
            // been rendered. Lame. Hack around this by splitting apart
            // the ','-concatenated 2-tuple again.
            fname = item.split(',')[0];

            options.updated(fname);
            return fname;
        },
        highlighter: function(item) {
            // Highlighting functions is a bit arduous - do it in
            // a helper function instead.
            return _this._renderItem(item, this.query);
        }
    });
    // A typeahead box will normally only offer suggestions when the input
    // is non-empty (at least one character).
    //
    // As we want to provide a view on the functions without having to
    // type anything (enumerate functions), add a focus handler to show
    // the dropdown.
    element.focus(function() {
        // If the box is not empty, do nothing to avoid getting in the
        // way of typeahead's own handlers.
        if (!element.data().typeahead.$element.val())
            element.data().typeahead.lookup();
    });
    // Given the above, this is a copy of typeahead.lookup() but with
    // a check for "this.query != ''" removed, so lookups occur even with
    // empty queries.
    element.data().typeahead.lookup = function (event) {
        this.query = this.$element.val();

        var items = $.isFunction(this.source)
            ? this.source(this.query, $.proxy(this.process, this))
            : this.source;
        
        return items ? this.process(items) : this;
    };
}

FunctionTypeahead.prototype = {
    update: function (name) {
        this.element.val(name);
        if (this.options.updated)
            this.options.updated(name);
    },
    changeSourceRun: function(rid, tid) {
        var this_ = this;
        $.ajax(g_urls.getFunctions, {
            dataType: "json",
            data: {'runid': rid, 'testid': tid},
            success: function(data) {
                this_.data = data;

                if (this_.options.sourceRunUpdated)
                    this_.options.sourceRunUpdated(data);
            }
        });
    },
    _source: function () {
        console.log(this.$element.data('functionTypeahead').data);
        return this.$element.data('functionTypeahead').data;
    },
    _renderItem: function (fn, query) {
        // Given a function name and the current query, return HTML for putting in
        // the function list dropdown.
        name = fn[0];
        counters = fn[1].counters;

        selected_ctr = this.options.getCounter();
        if (counters && selected_ctr in counters) {
            // We have counter information, so show it as a badge.
            //
            // Make the badge's background color depend on the counter %age.
            var value = counters[selected_ctr];

            var bg = '#fff';
            var hue = lerp(50.0, 0.0, value / 100.0);

            bg = 'hsl(' + hue.toFixed(0) + ', 100%, 50%)';

            counter_txt = '<span class="label label-inverse pull-left" ' +
                'style="background-color:' + bg + '; text-align: center; width: 40px; margin-right: 10px;">' + value.toFixed(1) + '%</span>';
        } else {
            // We don't have counter information :(
            counter_txt = '<span class="label label-inverse pull-left" style="text-align: center; width: 40%; margin-right: 10px;">'
                + '<i>no data</i></span>';
        }

        // This regex and code is taken from typeahead.highlighter(). If I knew
        // how to call typeahead.highlighter() from here, I would.
        var q = query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
        name_txt = name.replace(new RegExp('(' + q + ')', 'ig'), function ($1, match) {
            return '<strong>' + match + '</strong>'
        });
    
        return name_txt + counter_txt;
    }
};

$(document).ready(function () {
    jQuery.fn.extend({
        profile: function(arg1, arg2, arg3) {
            if (arg1 == 'go')
                this.data('profile').go(arg2, arg3);
            else if (arg1 && !arg2)
                this.data('profile',
                          new Profile(this,
                                      arg1.runid,
                                      arg1.testid,
                                      arg1.uniqueid));
            
            return this.data('profile');
        },
        statsBar: function(arg1, arg2) {
            if (arg1 == 'go')
                this.data('statsBar').go(arg2);
            else if (arg1 && !arg2)
                this.data('statsBar',
                          new StatsBar(this,
                                      arg1.testid));
            
            return this.data('statsBar');
        },
        runTypeahead: function(options) {
            if (options)
                this.data('runTypeahead',
                          new RunTypeahead(this, options));
            return this.data('runTypeahead');
        },
        functionTypeahead: function(options) {
            if (options)
                this.data('functionTypeahead',
                          new FunctionTypeahead(this, options));
            return this.data('functionTypeahead');
        }

    });
});

//////////////////////////////////////////////////////////////////////
// Global variables

// A dict of URLs we want to AJAX to, by some identifying key. This allows
// us to use v4_url_for() in profile_views.py and propagate that down to
// JS without hackery.
var g_urls;
// The test ID - this remains constant.
var g_testid;

// pf_make_stub: Given a machine name and run order, make the stub
// that goes in the "run" box (machine #order).
function pf_make_stub(machine, order) {
    return machine + " #" + order
}

// pf_init: Called with the request parameters to initialize the page.
// This not only sets up defaults but also sets up the typeahead instances.
function pf_init(run1, run2, testid, urls) {
    g_urls = urls;

    $('#fn1_box')
        .prop('disabled', true)
        .functionTypeahead({
            getCounter: function() {
                return pf_get_counter();
            },
            updated: function(fname) {
                 $('#profile1').profile('go', fname, pf_get_counter());
            },
            sourceRunUpdated: function(data) {
                pf_set_default_counter(data);

                var r1 = $('#run1_box').runTypeahead().getSelectedRunId();
                var r2 = $('#run2_box').runTypeahead().getSelectedRunId();
                var ids = [];
                if (r1)
                    ids.push(r1);
                if (r2)
                    ids.push(r2);
                
                $('#fn1_box').prop('disabled', false);
                $('#stats')
                    .statsBar({testid: testid})
                    .go(ids);
                $('#profile1').profile({runid: r1,
                                        testid: testid,
                                        uniqueid: 'l'});
            }
        });

    $('#fn2_box')
        .prop('disabled', true)
        .functionTypeahead({
            getCounter: function() {
                return pf_get_counter();
            },
            updated: function(fname) {
                 $('#profile2').profile('go', fname, pf_get_counter());
            },
            sourceRunUpdated: function(data) {
                pf_set_default_counter(data);

                var r1 = $('#run1_box').runTypeahead().getSelectedRunId();
                var r2 = $('#run2_box').runTypeahead().getSelectedRunId();
                var ids = [];
                if (r1)
                    ids.push(r1);
                if (r2)
                    ids.push(r2);

                $('#fn2_box').prop('disabled', false);
                $('#stats')
                    .statsBar({testid: testid})
                    .go(ids);
                $('#profile2').profile({runid: r1,
                                        testid: testid,
                                        uniqueid: 'r'});

            }
        });
    
    $('#run1_box')
        .runTypeahead({
            searchURL: g_urls.search,
            updated: function(name, id) {
                // Kick the functions dropdown to repopulate.
                $('#fn1_box')
                    .functionTypeahead()
                    .changeSourceRun(id, testid);
                pf_update_history();
            },
            cleared: function(name, id) {
                $('#fn1_box').val('').prop('disabled', true);
                $('#profile1').profile().reset();
            }
        })
        .update(pf_make_stub(run1.machine, run1.order), run1.id);

    var r2 = $('#run2_box')
        .runTypeahead({
            searchURL: g_urls.search,
            updated: function(name, id) {
                // Kick the functions dropdown to repopulate.
                $('#fn2_box')
                    .functionTypeahead()
                    .changeSourceRun(id, testid);
                pf_update_history();
            },
            cleared: function(name, id) {
                $('#fn2_box').val('').prop('disabled', true);
                $('#profile2').profile().reset();
            }
        });
    if (!$.isEmptyObject(run2))
        r2.update(pf_make_stub(run2.machine, run2.order), run2.id);

    // Bind change events for the counter dropdown so that profiles are
    // updated when it is modified.
    $('#counters').change(function () {
        g_counter = $('#counters').val();
        if ($('#fn1_box').val())
            $('#profile1').profile('go', $('#fn1_box').val(), g_counter);
        if ($('#fn2_box').val())
            $('#profile2').profile('go', $('#fn2_box').val(), g_counter);
    });

    // FIXME: Implement navigating to an address properly.
    // var go_to_hash = function () {
    //     s = document.location.hash.substring(1);

    //     var element = $('#address' + s);
    //     var header_offset = $('#header').height();
    //     $('html, body').animate({
    //         scrollTop: element.offset().top - header_offset
    //     }, 500);
    // };
}

var g_throbber_count = 0;
// pf_ajax_takeoff - An ajax request has started. Show the throbber if it
// wasn't shown before.
function pf_ajax_takeoff() {
    g_throbber_count ++;
    if (g_throbber_count == 1) {
        $('#throbber').show();
    }
}
// pf_ajax_land - An ajax request has finished (success or failure). If
// there are no more ajax requests in flight (flight! get it? take off,
// land? ha!), hide the throbber.
function pf_ajax_land() {
    g_throbber_count --;
    if (g_throbber_count == 0) {
        $('#throbber').hide();
    }
}

// pf_flash_error - show an error message, dismissable by the user.
function pf_flash_error(msg) {
    txt = '<div class="alert alert-error">' +
        '<button type="button" class="close" data-dismiss="alert">&times;</button>' +
        '<strong>Error</strong> ' + msg + '</div>';
    $('#flashes').append(txt);
}

// pf_flash_warning - show a warning message, dismissable by the user.
function pf_flash_warning(msg) {
    txt = '<div class="alert">' +
        '<button type="button" class="close" data-dismiss="alert">&times;</button>' +
        '<strong>Warning</strong> ' + msg + '</div>';
    $('#flashes').append(txt);
}

var g_counter;
var g_all_counters = [];
// FIXME: misnomer?
// pf_set_default_counter - set g_all_counters to all unique performance
// counters found in 'data'.
//
// If g_counter is not yet set, select a default counter and set it.
function pf_set_default_counter(data) {

    var all_counters = g_all_counters.slice(); // Copy
    // Ghetto solution for creating a set. ES5 Set doesn't appear to be
    // available on Chrome yet.
    for (i in data) {
        f = data[i][1];
        for (j in f.counters) {
            all_counters.push(j);
        }
    }
    // FIXME: Replace with a sort_and_unique() method? that'd be more
    // efficient.
    all_counters = unique_array(all_counters);
    all_counters.sort();

    // Only perform any updates if the counters have changed.
    if (g_all_counters != all_counters) {
        // Blow away all previous counter options and re-add them.
        box = $('#counters').empty();
        for (i in all_counters) {
            var ctr = all_counters[i];
            box.append(
                $('<option></option>').text(ctr)
            );
        }
        // Re-select the previous value if it existed.
        if (g_counter != null) {
            box.val(g_counter);
        }

        g_all_counters = all_counters;
    }
    
    if (g_counter == null) {
        // Select a default. If 'cycles' exists, we pick that, else we
        // pick the first we see.
        if (g_all_counters.indexOf('cycles') != -1)
            g_counter = 'cycles';
        else
            g_counter = g_all_counters[0];
        $('#counters').val(g_counter);
    }
}

// pf_get_counter - Poor encapsulation of the g_counter object.
function pf_get_counter() {
    return g_counter;
}

// pf_update_history - Push a new history entry, as we've just navigated
// to what could be a new bookmarkable page.
function pf_update_history() {
    var url;
    if (g_runids[1]) {
        url = g_urls.comparison_template
            .replace('<testid>', g_testid)
            .replace('<run1id>', g_runids[0])
            .replace('<run2id>', g_runids[1]);
    } else {
        url = g_urls.singlerun_template
            .replace('<testid>', g_testid)
            .replace('<run1id>', g_runids[0]);
    }
    history.pushState({}, document.title, url);
}

//////////////////////////////////////////////////////////////////////
// Helper functions

function unique_array(a) {
    var unique = [];
    for (var i = 0; i < a.length; i++) {
        if (unique.indexOf(a[i]) == -1) {
            unique.push(a[i]);
        }
    }
    return unique;
}

function add_commas(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}

function lerp(s, e, x) {
    return s + (e - s) * x;
}